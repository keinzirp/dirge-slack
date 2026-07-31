import type { Config } from '#src/env.ts'
import { cleanupWorktree, findPr } from '#src/git/index.ts'
import type { SessionStore, ThreadState } from '#src/state/session.ts'

type PullRequestState = {
  state?: string
  mergedAt?: string
}

const isClosedPr = (pr: PullRequestState): boolean => {
  return pr.state === 'CLOSED' || Boolean(pr.mergedAt)
}

const clearPrState = (thread: ThreadState): void => {
  thread.prUrl = undefined
  thread.prState = undefined
}

const cleanupClosedPrWorktrees = async (options: {
  store: SessionStore
  config: Config
}): Promise<void> => {
  const { store, config } = options

  for (const thread of store.allThreads()) {
    if (!thread.worktreePath || !thread.prUrl) {
      continue
    }

    const pr = await findPr({ cwd: thread.worktreePath })
    if (!pr) {
      continue
    }

    thread.prState = pr.state
    if (isClosedPr(pr)) {
      await cleanupWorktree({ baseRepo: config.git.workdir, thread })
      clearPrState(thread)
    }
  }
}

export { cleanupClosedPrWorktrees, clearPrState, isClosedPr }
