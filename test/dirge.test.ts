import { describe, test } from 'vitest'

import { parseDirgeOutput } from '#src/dirge/index.ts'
import { getDirgeArgs } from '#src/dirge/run.ts'

describe('Dirge helpers', () => {
  test('builds read-only argv', ({ expect }) => {
    expect(
      getDirgeArgs({
        cwd: '/repo',
        prompt: 'explain',
        sessionId: 's1',
        readOnly: true,
        promptName: 'ask',
        config: {
          bin: 'dirge',
          maxTurns: '60',
          sandbox: 'bwrap',
          timeoutMs: 1000,
          rawLogs: false,
          provider: undefined,
          model: undefined,
          configDir: '/tmp/dirge-config',
        },
      }),
    ).toEqual(expect.arrayContaining(['--restrictive', '--prompt', 'ask']))
  })

  test('uses sandbox off for code runs', ({ expect }) => {
    expect(
      getDirgeArgs({
        cwd: '/repo',
        prompt: 'fix',
        sessionId: 's1',
        readOnly: false,
        promptName: 'code',
        config: {
          bin: 'dirge',
          maxTurns: '60',
          sandbox: 'bwrap',
          timeoutMs: 1000,
          rawLogs: false,
          provider: undefined,
          model: undefined,
          configDir: '/tmp/dirge-config',
        },
      }),
    ).toEqual(expect.arrayContaining(['--accept-all', '--sandbox', 'off']))
  })

  test('parses stream-json result envelope', ({ expect }) => {
    const parsed = parseDirgeOutput(
      '{"type":"result","subtype":"success","is_error":false,"result":"done","session_id":"sid","files_changed":["src/a.ts"]}\n',
    )
    expect(parsed).toEqual({
      finalResponse: 'done',
      changedFiles: ['src/a.ts'],
      isError: false,
      errorSummary: undefined,
    })
  })

  test('parses stream-json max-turn errors', ({ expect }) => {
    const parsed = parseDirgeOutput(
      '{"type":"result","subtype":"error_max_turns","is_error":true,"result":"","files_changed":[]}',
    )
    expect(parsed.errorSummary).toBe('Dirge hit max agent turns')
  })
})
