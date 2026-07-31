import { describe, test } from 'vitest'

import { clearPrState, isClosedPr } from '#src/cleanup.ts'
import type { ThreadState } from '#src/state/session.ts'

describe('cleanup helpers', () => {
  test('detects closed and merged PRs', ({ expect }) => {
    expect(isClosedPr({ state: 'CLOSED' })).toBe(true)
    expect(
      isClosedPr({ state: 'OPEN', mergedAt: '2026-01-01T00:00:00Z' }),
    ).toBe(true)
    expect(isClosedPr({ state: 'OPEN' })).toBe(false)
  })

  test('clears stale PR state', ({ expect }) => {
    const thread: ThreadState = {
      teamId: 'T1',
      channelId: 'C1',
      threadTs: '1',
      sessionId: 's1',
      hasWorktree: false,
      prUrl: 'https://example.com/pr/1',
      prState: 'OPEN',
    }

    clearPrState(thread)

    expect(thread.prUrl).toBeUndefined()
    expect(thread.prState).toBeUndefined()
  })
})
