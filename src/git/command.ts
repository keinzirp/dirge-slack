import { access, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import type { GitConfig } from '#src/env.ts'
import type { ThreadState } from '#src/state/session.ts'
import { exec } from '#src/utils/exec.ts'

import { nameFromPrompt } from './name.ts'

const git = async (options: {
  cwd: string
  args: string[]
  timeoutMs?: number
  signal?: AbortSignal
}) => {
  return await exec({
    command: 'git',
    args: options.args,
    cwd: options.cwd,
    timeoutMs: options.timeoutMs ?? 60_000,
    signal: options.signal,
  })
}

const checkedGit = async (options: {
  cwd: string
  args: string[]
  timeoutMs?: number
  signal?: AbortSignal
}) => {
  const result = await git(options)
  if (result.code !== 0) {
    throw new Error(
      result.stderr || result.stdout || `git ${options.args.join(' ')} failed`,
    )
  }
  return result
}

const cleanDirgeState = async (options: { cwd: string }): Promise<void> => {
  await checkedGit({ cwd: options.cwd, args: ['clean', '-fd', '.dirge'] })
}

const isDirty = async (options: { cwd: string }): Promise<boolean> => {
  await cleanDirgeState(options)
  const result = await checkedGit({
    cwd: options.cwd,
    args: ['status', '--porcelain'],
  })
  return result.stdout.trim().length > 0
}

const branchExists = async (options: {
  workdir: string
  branchName: string
}): Promise<boolean> => {
  const result = await git({
    cwd: options.workdir,
    args: ['show-ref', '--verify', `refs/heads/${options.branchName}`],
  })
  return result.code === 0
}

const ensureWorktree = async (options: {
  thread: ThreadState
  prompt: string
  gitConfig: GitConfig
}) => {
  const { thread, prompt, gitConfig } = options

  if (thread.hasWorktree && thread.worktreePath && thread.branchName) {
    await cleanDirgeState({ cwd: thread.worktreePath })
    const hasPendingChanges = await isDirty({ cwd: thread.worktreePath })
    await installPnpmDeps({
      cwd: thread.worktreePath,
      timeoutMs: gitConfig.timeoutMs,
    })
    return {
      created: false,
      hasPendingChanges,
      worktreePath: thread.worktreePath,
      branchName: thread.branchName,
    }
  }

  await mkdir(path.join(gitConfig.stateDir, 'worktrees'), { recursive: true })
  await checkedGit({
    cwd: gitConfig.workdir,
    args: ['fetch', 'origin', gitConfig.baseBranch],
  })

  const baseName = nameFromPrompt(prompt)
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? '' : `-${index}`
    const worktreeName = `${baseName}${suffix}`
    const branchName = `${gitConfig.branchPrefix}${worktreeName}`
    const worktreePath = path.join(
      gitConfig.stateDir,
      'worktrees',
      worktreeName,
    )

    if (await branchExists({ workdir: gitConfig.workdir, branchName })) {
      continue
    }

    const result = await git({
      cwd: gitConfig.workdir,
      args: [
        'worktree',
        'add',
        '-b',
        branchName,
        worktreePath,
        `origin/${gitConfig.baseBranch}`,
      ],
    })
    if (result.code !== 0) {
      if (/already exists/i.test(result.output)) {
        continue
      }
      throw new Error(result.stderr || result.stdout)
    }

    await installPnpmDeps({ cwd: worktreePath, timeoutMs: gitConfig.timeoutMs })
    thread.hasWorktree = true
    thread.branchName = branchName
    thread.worktreePath = worktreePath
    return { created: true, hasPendingChanges: false, worktreePath, branchName }
  }

  throw new Error('Could not allocate a unique worktree name')
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function installPnpmDeps(options: {
  cwd: string
  timeoutMs: number
  signal?: AbortSignal
}): Promise<void> {
  if (
    !(await exists(path.join(options.cwd, 'pnpm-lock.yaml'))) ||
    (await exists(path.join(options.cwd, 'node_modules')))
  ) {
    return
  }

  const result = await exec({
    command: 'pnpm',
    args: ['install', '--frozen-lockfile'],
    cwd: options.cwd,
    timeoutMs: options.timeoutMs,
    signal: options.signal,
  })
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'pnpm install failed')
  }
}

type CheckCommand = 'just qa' | 'just check'

const getCheckCommand = (
  value: string | undefined,
): CheckCommand | undefined => {
  const command = value === undefined ? 'just qa' : value.trim()
  if (!command || command.toLowerCase() === 'off') {
    return undefined
  }
  if (command !== 'just qa' && command !== 'just check') {
    throw new Error(
      'DIRGE_SLACK_CHECK_COMMANDS only supports "just qa", "just check", or "off"',
    )
  }
  return command
}

const diffSnapshot = async (options: { cwd: string }): Promise<string> => {
  await cleanDirgeState({ cwd: options.cwd })
  const status = await checkedGit({
    cwd: options.cwd,
    args: ['status', '--porcelain'],
  })
  const diff = await checkedGit({
    cwd: options.cwd,
    args: ['diff', '--no-ext-diff'],
  })
  const stagedDiff = await checkedGit({
    cwd: options.cwd,
    args: ['diff', '--cached', '--no-ext-diff'],
  })
  return `${status.stdout}\n${diff.stdout}\n${stagedDiff.stdout}`
}

const runChecks = async (options: {
  cwd: string
  gitConfig: GitConfig
  signal?: AbortSignal
}) => {
  const command = getCheckCommand(options.gitConfig.checkCommands)
  if (!command) {
    return { ok: true, skipped: true, summary: 'checks disabled' }
  }

  await installPnpmDeps({
    cwd: options.cwd,
    timeoutMs: options.gitConfig.timeoutMs,
    signal: options.signal,
  })

  const before = await diffSnapshot({ cwd: options.cwd })
  const recipe = command === 'just qa' ? 'qa' : 'check'
  const result = await exec({
    command: 'just',
    args: [recipe],
    cwd: options.cwd,
    timeoutMs: options.gitConfig.timeoutMs,
    signal: options.signal,
  })
  const after = await diffSnapshot({ cwd: options.cwd })
  const mutated = before !== after
  const ok = result.code === 0 && !mutated

  return {
    ok,
    skipped: false,
    summary: `${command}: ${ok ? 'passed' : 'failed'}${mutated ? ' (mutated worktree)' : ''}`,
    output: mutated
      ? `${result.output}\nCheck command mutated the worktree. Use a read-only check command.`
      : result.output,
  }
}

type GitIdentity = {
  name: string
  email: string
}

const getGitIdentity = async (options: {
  cwd: string
}): Promise<GitIdentity> => {
  const [name, email] = await Promise.all([
    git({ cwd: options.cwd, args: ['config', 'user.name'] }),
    git({ cwd: options.cwd, args: ['config', 'user.email'] }),
  ])

  if (name.code !== 0 || email.code !== 0) {
    throw new Error('Git identity is not configured')
  }

  const identity = {
    name: name.stdout.trim(),
    email: email.stdout.trim(),
  }
  if (!identity.name || !identity.email) {
    throw new Error('Git identity is not configured')
  }
  return identity
}

const verifyGhAuth = async (options: { cwd: string }): Promise<void> => {
  const result = await exec({
    command: 'gh',
    args: ['auth', 'status'],
    cwd: options.cwd,
    timeoutMs: 30_000,
  })
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || 'gh auth status failed')
  }
}

type PullRequestInfo = {
  url?: string
  state?: string
  mergedAt?: string
}

const findPr = async (options: {
  cwd: string
}): Promise<PullRequestInfo | undefined> => {
  const result = await exec({
    command: 'gh',
    args: ['pr', 'view', '--json', 'url,state,mergedAt'],
    cwd: options.cwd,
    timeoutMs: 30_000,
  })
  if (result.code !== 0) {
    return undefined
  }

  try {
    return JSON.parse(result.stdout) as PullRequestInfo
  } catch {
    return undefined
  }
}

const cleanupWorktree = async (options: {
  baseRepo: string
  thread: ThreadState
}): Promise<string> => {
  const { baseRepo, thread } = options
  if (!thread.worktreePath) {
    return 'no worktree'
  }
  if (await isDirty({ cwd: thread.worktreePath })) {
    return `dirty worktree retained: ${thread.worktreePath}`
  }

  await checkedGit({
    cwd: baseRepo,
    args: ['worktree', 'remove', thread.worktreePath],
  })
  await rm(thread.worktreePath, { recursive: true, force: true })
  thread.hasWorktree = false
  thread.worktreePath = undefined
  thread.branchName = undefined
  return 'clean worktree removed'
}

export {
  checkedGit,
  cleanDirgeState,
  cleanupWorktree,
  ensureWorktree,
  findPr,
  getCheckCommand,
  getGitIdentity,
  git,
  isDirty,
  runChecks,
  verifyGhAuth,
}
