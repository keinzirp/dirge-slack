import { spawn } from 'node:child_process'

const STDOUT = 0
const STDERR = 1

type ExecOptions = {
  command: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  signal?: AbortSignal
  timeoutMs?: number
}

type ExecEvent = [typeof STDOUT | typeof STDERR, string]

type ExecResult = {
  code: number | undefined
  signal: NodeJS.Signals | undefined
  stdout: string
  stderr: string
  output: string
  timedOut: boolean
}

const exec = async (options: ExecOptions): Promise<ExecResult> => {
  const { command, args, cwd, env = process.env, signal, timeoutMs } = options

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    })

    let timedOut = false
    let stdout = ''
    let stderr = ''
    const output: ExecEvent[] = []
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true
          child.kill('SIGTERM')
        }, timeoutMs)
      : undefined
    timer?.unref?.()

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      output.push([STDOUT, chunk])
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
      output.push([STDERR, chunk])
    })
    child.on('error', reject)
    child.on('close', (code, exitSignal) => {
      if (timer) {
        clearTimeout(timer)
      }
      resolve({
        code: code ?? undefined,
        signal: exitSignal ?? undefined,
        stdout,
        stderr,
        output: output.map(([, chunk]) => chunk).join(''),
        timedOut,
      })
    })
  })
}

export type { ExecOptions, ExecResult }
export { exec }
