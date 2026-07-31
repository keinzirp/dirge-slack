import { describe, test } from 'vitest'

import { chunkSlack, classifyJob, stripMentions } from '#src/slack/index.ts'
import { getSessionId } from '#src/state/session.ts'

describe('Slack routing helpers', () => {
  test('keeps one session id per Slack thread', ({ expect }) => {
    expect(
      getSessionId({ teamId: 'T1', channelId: 'C1', threadTs: '123.456' }),
    ).toBe('slack-T1-C1-123.456')
  })

  test('classifies read-only and code-changing prompts', ({ expect }) => {
    expect(classifyJob('explain how auth works')).toBe('read')
    expect(classifyJob('fix the auth bug')).toBe('code')
    expect(classifyJob('review and patch if needed')).toBe('code')
  })

  test('strips Slack mention tokens', ({ expect }) => {
    expect(stripMentions('<@U123> explain this <@U456>')).toBe('explain this')
  })

  test('chunks long Slack replies', ({ expect }) => {
    expect(chunkSlack({ text: 'a'.repeat(8000), limit: 3500 })).toHaveLength(3)
  })
})
