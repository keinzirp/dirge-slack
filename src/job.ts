import { runDirge } from '#src/dirge/index.ts'
import type { Config } from '#src/env.ts'
import {
  commitIfNeeded,
  createPr,
  ensureWorktree,
  findPr,
  pushBranch,
  runChecks,
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
  const transitionNote = worktree.created
    ? `This Slack thread is now running in a Git worktree at ${worktree.worktreePath}. Earlier messages may have inspected the base repo. Re-read files before editing and do not rely on stale file contents from prior turns.\n\n`
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

  const branchShortName = worktree.branchName.replace(
    config.git.branchPrefix,
    '',
  )
  const commit = await commitIfNeeded({
    cwd: worktree.worktreePath,
    message: `Dirge Slack: ${branchShortName}`,
  })
  const files = result.changedFiles

  if (commit) {
    await pushBranch({
      cwd: worktree.worktreePath,
      branchName: worktree.branchName,
    })
    const pr = await createPr({
      cwd: worktree.worktreePath,
      branchName: worktree.branchName,
      baseBranch: config.git.baseBranch,
      title: `Dirge Slack: ${branchShortName}`,
      body: `Slack thread: ${thread.channelId}/${thread.threadTs}\n\nSession: ${thread.sessionId}`,
    })
    thread.prUrl = pr.url
    thread.prState = pr.state
  } else {
    const pr = await findPr({ cwd: worktree.worktreePath })
    if (pr?.url) {
      thread.prUrl = pr.url
      thread.prState = pr.state
    }
  }

  return [
    result.finalResponse,
    '',
    `Worktree: ${worktree.worktreePath}`,
    `Branch: ${worktree.branchName}`,
    commit ? `Commit: ${commit}` : 'Commit: none',
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
