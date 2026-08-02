import { access } from 'node:fs/promises'
import path from 'node:path'

import type { DirgeConfig } from '#src/env.ts'
import { exec } from '#src/utils/exec.ts'

import { parseDirgeOutput } from './stream.ts'

type RunDirgeOptions = {
  cwd: string
  prompt: string
  sessionId: string
  readOnly: boolean
  promptName: string
  config: DirgeConfig
  signal?: AbortSignal
  env?: NodeJS.ProcessEnv
}

type DirgeRunResult = {
  ok: boolean
  exitCode: number | undefined
  finalResponse: string
  changedFiles: string[]
  rawLog: string
  timedOut: boolean
}

const getDirgeArgs = (options: RunDirgeOptions): string[] => {
  const args = [
    '-p',
    '--session',
    options.sessionId,
    options.readOnly ? '--restrictive' : '--accept-all',
    '--prompt',
    options.promptName,
    '--output-format',
    'stream-json',
    '--max-agent-turns',
    options.config.maxTurns,
    '--sandbox',
    options.config.sandbox,
  ]

  if (options.config.provider) {
    args.push('--provider', options.config.provider)
  }
  if (options.config.model) {
    args.push('--model', options.config.model)
  }

  args.push('--', options.prompt)
  return args
}

const runDirge = async (options: RunDirgeOptions): Promise<DirgeRunResult> => {
  const result = await exec({
    command: options.config.bin,
    args: getDirgeArgs(options),
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      DIRGE_CONFIG_DIR: options.config.configDir,
    },
    timeoutMs: options.config.timeoutMs,
    signal: options.signal,
    teeOutput: options.config.rawLogs,
  })
  const parsed = parseDirgeOutput(result.output)

  return {
    ok: result.code === 0 && !result.timedOut && !parsed.isError,
    exitCode: result.code,
    finalResponse: parsed.finalResponse,
    changedFiles: parsed.changedFiles,
    rawLog: result.output,
    timedOut: result.timedOut,
  }
}

const verifySlackPluginFiles = async (options: {
  configDir: string
}): Promise<void> => {
  const pluginDir = path.join(options.configDir, 'plugins', 'slack')
  await Promise.all(
    ['00-state.janet', '01-hooks.janet', '02-gates.janet'].map((file) =>
      access(path.join(pluginDir, file)),
    ),
  ).catch((error: unknown) => {
    throw new Error(
      `Required Slack Janet plugin files are missing in ${pluginDir}`,
      { cause: error },
    )
  })
}

const verifySlackPlugin = async (options: {
  cwd: string
  config: DirgeConfig
}): Promise<void> => {
  await verifySlackPluginFiles({ configDir: options.config.configDir })

  const result = await runDirge({
    cwd: options.cwd,
    prompt: 'status check',
    sessionId: `dirge-slack-startup-check-${Date.now()}`,
    readOnly: true,
    promptName: 'ask',
    config: {
      ...options.config,
      timeoutMs: Math.min(options.config.timeoutMs, 60_000),
    },
    env: {
      DIRGE_SLACK_THREAD_TS: 'startup-check',
      DIRGE_SLACK_MODE: 'read',
      DIRGE_SLACK_STATUS_CHECK: '1',
    },
  })

  if (
    !result.ok ||
    !/dirge-slack plugin 0\.1\.0 ok/i.test(result.finalResponse)
  ) {
    throw new Error('Required Slack Janet plugin handshake failed')
  }
}

export type { DirgeRunResult, RunDirgeOptions }
export { getDirgeArgs, runDirge, verifySlackPlugin }
