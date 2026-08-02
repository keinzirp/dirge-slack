type JobKind = 'read' | 'code'

const writeIntent =
  /\b(implement|add|adds|change|modify|update|fix|refactor|remove|delete|rename|edit|patch|commit|push)\b|\b(write code|open a pr|create a pr|raise a pr|pull request)\b/i
const ambiguousWrite =
  /\b(if needed|as needed|support for|make it|can you add|please add)\b/i

const classifyJob = (prompt: string): JobKind => {
  if (writeIntent.test(prompt) || ambiguousWrite.test(prompt)) {
    return 'code'
  }
  return 'read'
}

export type { JobKind }
export { classifyJob }
