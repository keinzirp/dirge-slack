import { describe, test } from 'vitest'

import {
  defaultStateDir,
  getCheckCommand,
  kebabCase,
  nameFromPrompt,
} from '#src/git/index.ts'

describe('Git helpers', () => {
  test('generates safe names', ({ expect }) => {
    expect(kebabCase('Add Slack bridge!!')).toBe('add-slack-bridge')
    expect(nameFromPrompt('please add a Slack bridge for this repo')).toBe(
      'add-slack-bridge-repo',
    )
  })

  test('defaults state outside the repo', ({ expect }) => {
    expect(defaultStateDir({ workdir: '/tmp/repo' })).toBe(
      '/tmp/.dirge-slack/repo',
    )
  })

  test('uses just qa as the default check command', ({ expect }) => {
    expect(getCheckCommand(undefined)).toBe('just qa')
    expect(getCheckCommand('just check')).toBe('just check')
    expect(getCheckCommand('off')).toBeUndefined()
    expect(getCheckCommand('')).toBeUndefined()
  })

  test('rejects custom check commands', ({ expect }) => {
    expect(() => getCheckCommand('pnpm test')).toThrow(
      'DIRGE_SLACK_CHECK_COMMANDS only supports "just qa", "just check", or "off"',
    )
  })
})
