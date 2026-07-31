import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceConfigDir = (): string => {
  if (process.env.DIRGE_CONFIG_DIR) {
    return process.env.DIRGE_CONFIG_DIR
  }
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'dirge')
  }
  return path.join(os.homedir(), '.config', 'dirge')
}

const localPluginDir = (): string => {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'plugins',
    'slack',
  )
}

const readConfig = async (
  configDir: string,
): Promise<Record<string, unknown>> => {
  try {
    return JSON.parse(
      await readFile(path.join(configDir, 'config.json'), 'utf8'),
    ) as Record<string, unknown>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

const installDirgeRuntime = async (options: {
  configDir: string
}): Promise<void> => {
  const targetDir = options.configDir
  await mkdir(targetDir, { recursive: true })

  const targetPluginDir = path.join(targetDir, 'plugins', 'slack')
  await rm(targetPluginDir, { recursive: true, force: true })
  await mkdir(targetPluginDir, { recursive: true })
  await cp(localPluginDir(), targetPluginDir, { recursive: true, force: true })

  const config = await readConfig(sourceConfigDir())
  await writeFile(
    path.join(targetDir, 'config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  )
}

export { installDirgeRuntime }
