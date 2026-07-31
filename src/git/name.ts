import path from 'node:path'

const kebabCase = (value: string): string => {
  const name = value
    .toLowerCase()
    .replace(/<@[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')

  return name || 'slack-thread'
}

const nameFromPrompt = (prompt: string): string => {
  const stopWords = new Set([
    'please',
    'can',
    'you',
    'the',
    'a',
    'an',
    'to',
    'for',
    'and',
    'or',
    'in',
    'of',
    'this',
    'that',
  ])

  return kebabCase(
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0 && !stopWords.has(word))
      .slice(0, 7)
      .join('-'),
  )
}

const defaultStateDir = (options: { workdir: string }): string => {
  return path.resolve(
    options.workdir,
    '..',
    '.dirge-slack',
    path.basename(options.workdir),
  )
}

export { defaultStateDir, kebabCase, nameFromPrompt }
