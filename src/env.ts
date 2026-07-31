import path from 'node:path'
import * as process from 'node:process'
import { z } from 'zod/v4'

import { defaultStateDir } from '#src/git/name.ts'
import { once } from '#src/utils/once.ts'

const $env = z.object({
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  DIRGE_SLACK_WORKDIR: z.string().min(1),
  DIRGE_BIN: z.string().min(1).default('dirge'),
  DIRGE_SLACK_STATE_DIR: z.string().optional(),
  DIRGE_SLACK_ALLOWED_CHANNELS: z.string().min(1),
  DIRGE_SLACK_ALLOWED_USERS: z.string().min(1),
  DIRGE_SLACK_BASE_BRANCH: z.string().min(1).default('main'),
  DIRGE_SLACK_BRANCH_PREFIX: z.string().min(1).default('dirge/'),
  DIRGE_SLACK_MAX_TURNS: z.coerce.number().int().positive().default(60),
  DIRGE_SLACK_TIMEOUT_MINUTES: z.coerce.number().positive().default(30),
  DIRGE_SLACK_SANDBOX: z.string().min(1).default('bwrap'),
  DIRGE_SLACK_CHECK_COMMANDS: z.string().optional(),
  DIRGE_SLACK_PROVIDER: z.string().optional(),
  DIRGE_SLACK_MODEL: z.string().optional(),
})

const splitCsv = (value: string): ReadonlySet<string> => {
  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
}

const getConfig = once(() => {
  const env = $env.parse(process.env)
  const workdir = path.resolve(env.DIRGE_SLACK_WORKDIR)
  const timeoutMs = env.DIRGE_SLACK_TIMEOUT_MINUTES * 60_000
  const stateDir = path.resolve(
    workdir,
    env.DIRGE_SLACK_STATE_DIR ?? defaultStateDir({ workdir }),
  )

  return {
    slack: {
      appToken: env.SLACK_APP_TOKEN,
      botToken: env.SLACK_BOT_TOKEN,
      allowedChannels: splitCsv(env.DIRGE_SLACK_ALLOWED_CHANNELS),
      allowedUsers: splitCsv(env.DIRGE_SLACK_ALLOWED_USERS),
    },
    dirge: {
      bin: env.DIRGE_BIN,
      maxTurns: String(env.DIRGE_SLACK_MAX_TURNS),
      sandbox: env.DIRGE_SLACK_SANDBOX,
      timeoutMs,
      provider: env.DIRGE_SLACK_PROVIDER,
      model: env.DIRGE_SLACK_MODEL,
      configDir: path.join(stateDir, 'dirge-config'),
    },
    git: {
      workdir,
      stateDir,
      baseBranch: env.DIRGE_SLACK_BASE_BRANCH,
      branchPrefix: env.DIRGE_SLACK_BRANCH_PREFIX,
      checkCommands: env.DIRGE_SLACK_CHECK_COMMANDS,
      timeoutMs,
    },
  }
})

type Config = ReturnType<typeof getConfig>
type DirgeConfig = {
  bin: string
  maxTurns: string
  sandbox: string
  timeoutMs: number
  provider: string | undefined
  model: string | undefined
  configDir: string
}
type GitConfig = Config['git']
type SlackConfig = Config['slack']

export type { Config, DirgeConfig, GitConfig, SlackConfig }
export { getConfig }
