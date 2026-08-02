import { runDirge } from '#src/dirge/index.ts'
import type { Config } from '#src/env.ts'
import {
  ensureWorktree,
  findPr,
  getGitIdentity,
  runChecks,
  verifyGhAuth,
} from '#src/git/index.ts'
import type { ThreadState } from '#src/state/session.ts'

const runReadJob = async (options: {
  prompt: string
  sessionId: string
  config: Config
  signal: AbortSignal
}): Promise<string> => {
  const { prompt, sessionId, config, signal } = options
  const result = await runDirge({
    cwd: config.git.workdir,
    prompt,
    sessionId,
    readOnly: true,
    promptName: 'ask',
    config: config.dirge,
    signal,
    env: {
      DIRGE_SLACK_THREAD_TS: sessionId,
      DIRGE_SLACK_MODE: 'read',
    },
  })

  if (!result.ok) {
    throw new Error(
      result.timedOut ? 'Dirge timed out' : `Dirge exited ${result.exitCode}`,
    )
  }

  return result.finalResponse
}

const runCodeJob = async (options: {
  prompt: string
  thread: ThreadState
  config: Config
  signal: AbortSignal
}): Promise<string> => {
  const { prompt, thread, config, signal } = options
  const worktree = await ensureWorktree({
    thread,
    prompt,
    gitConfig: config.git,
  })
  const [gitIdentity] = await Promise.all([
    getGitIdentity({ cwd: worktree.worktreePath }),
    verifyGhAuth({ cwd: worktree.worktreePath }),
  ])
  const transitionNote = worktree.created
    ? `This Slack thread is now running in a Git worktree at ${worktree.worktreePath}. Earlier messages may have inspected the base repo. Re-read files before editing and do not rely on stale file contents from prior turns.\n\n`
    : worktree.hasPendingChanges
      ? 'This Slack thread is continuing in a worktree with uncommitted changes from a prior failed run. Inspect git status and git diff before editing, then continue from that state.\n\n'
      : ''

  const result = await runDirge({
    cwd: worktree.worktreePath,
    prompt: `${transitionNote}${prompt}`,
    sessionId: thread.sessionId,
    readOnly: false,
    promptName: 'code',
    config: config.dirge,
    signal,
    env: {
      DIRGE_SLACK_THREAD_TS: thread.threadTs,
      DIRGE_SLACK_MODE: 'code',
      DIRGE_SLACK_BRANCH_NAME: worktree.branchName,
      DIRGE_SLACK_BRANCH_PREFIX: config.git.branchPrefix,
      GIT_AUTHOR_NAME: gitIdentity.name,
      GIT_AUTHOR_EMAIL: gitIdentity.email,
      GIT_COMMITTER_NAME: gitIdentity.name,
      GIT_COMMITTER_EMAIL: gitIdentity.email,
    },
  })

  if (!result.ok) {
    throw new Error(
      result.timedOut ? 'Dirge timed out' : `Dirge exited ${result.exitCode}`,
    )
  }

  const checks = await runChecks({
    cwd: worktree.worktreePath,
    gitConfig: config.git,
    signal,
  })
  if (!checks.ok) {
    throw new Error(`checks failed\n${checks.output ?? checks.summary}`)
  }

  const files = result.changedFiles
  const pr = await findPr({ cwd: worktree.worktreePath })
  if (!pr?.url) {
    throw new Error('Dirge did not create a pull request')
  }
  thread.prUrl = pr.url
  thread.prState = pr.state

  return [
    result.finalResponse,
    '',
    `Worktree: ${worktree.worktreePath}`,
    `Branch: ${worktree.branchName}`,
    thread.prUrl ? `PR: ${thread.prUrl}` : 'PR: none',
    formatChangedFiles(files),
    `Checks: ${checks.summary}`,
  ].join('\n')
}

const formatChangedFiles = (files: string[]): string => {
  if (files.length === 0) {
    return 'Changed files: none'
  }
  return `Changed files:\n${files.map((file) => `- ${file}`).join('\n')}`
}

export { formatChangedFiles, runCodeJob, runReadJob }
