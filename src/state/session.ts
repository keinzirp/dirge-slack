import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type ThreadState = {
  teamId: string
  channelId: string
  threadTs: string
  sessionId: string
  hasWorktree: boolean
  branchName?: string
  worktreePath?: string
  prUrl?: string
  prState?: string
}

type StateFile = {
  threads: Record<string, ThreadState>
  recentEventIds: string[]
}

type SessionStore = {
  load: () => Promise<void>
  save: () => Promise<void>
  getOrCreate: (options: ThreadKeyOptions) => ThreadState
  wasSeenEvent: (eventId: string) => boolean
  rememberEvent: (eventId: string) => void
  allThreads: () => ThreadState[]
}

type ThreadKeyOptions = {
  teamId: string
  channelId: string
  threadTs: string
}

const createEmptyState = (): StateFile => {
  return { threads: {}, recentEventIds: [] }
}

const getThreadKey = (options: ThreadKeyOptions): string => {
  const { teamId, channelId, threadTs } = options
  return `${teamId}:${channelId}:${threadTs}`
}

const getSessionId = (options: ThreadKeyOptions): string => {
  const { teamId, channelId, threadTs } = options
  return `slack-${teamId}-${channelId}-${threadTs}`
}

const createSessionStore = (options: { stateDir: string }): SessionStore => {
  const { stateDir } = options
  const file = path.join(stateDir, 'state.json')
  let state = createEmptyState()

  return {
    load: async () => {
      await mkdir(stateDir, { recursive: true })
      try {
        state = JSON.parse(await readFile(file, 'utf8')) as StateFile
        state.threads ??= {}
        state.recentEventIds ??= []
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
        state = createEmptyState()
      }
    },

    save: async () => {
      await mkdir(stateDir, { recursive: true })
      await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    },

    getOrCreate: (thread) => {
      const key = getThreadKey(thread)
      const existing = state.threads[key]
      if (existing) {
        return existing
      }

      const created: ThreadState = {
        ...thread,
        sessionId: getSessionId(thread),
        hasWorktree: false,
      }
      state.threads[key] = created
      return created
    },

    wasSeenEvent: (eventId) => state.recentEventIds.includes(eventId),

    rememberEvent: (eventId) => {
      state.recentEventIds = [
        eventId,
        ...state.recentEventIds.filter((id) => id !== eventId),
      ].slice(0, 500)
    },

    allThreads: () => Object.values(state.threads),
  }
}

export type { SessionStore, ThreadState }
export { createSessionStore, getSessionId }
