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
          provider: undefined,
          model: undefined,
          configDir: '/tmp/dirge-config',
        },
      }),
    ).toEqual(expect.arrayContaining(['--restrictive', '--prompt', 'ask']))
  })

  test('parses stream-json result envelope', ({ expect }) => {
    const parsed = parseDirgeOutput(
      '{"type":"result","subtype":"success","is_error":false,"result":"done","session_id":"sid","files_changed":["src/a.ts"]}\n',
    )
    expect(parsed).toEqual({
      finalResponse: 'done',
      changedFiles: ['src/a.ts'],
      isError: false,
    })
  })
})
