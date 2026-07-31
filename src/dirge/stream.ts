type StreamEvent = Record<string, unknown>

type ParsedDirgeOutput = {
  finalResponse: string
  changedFiles: string[]
  isError: boolean
}

const parseJsonLine = (line: string): StreamEvent | undefined => {
  try {
    return JSON.parse(line) as StreamEvent
  } catch {
    return undefined
  }
}

const textFromEvent = (event: StreamEvent): string | undefined => {
  for (const key of ['final', 'response', 'text', 'content', 'message']) {
    const value = event[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = textFromEvent(value as StreamEvent)
      if (nested) {
        return nested
      }
    }
  }
  return undefined
}

const filesFromEvent = (event: StreamEvent): string[] => {
  const files =
    event.files_changed ??
    event.changedFiles ??
    event.changed_files ??
    event.files
  if (!Array.isArray(files)) {
    return []
  }
  return files.filter((file): file is string => typeof file === 'string')
}

const parseDirgeOutput = (output: string): ParsedDirgeOutput => {
  let finalResponse = ''
  let isError = false
  const changedFiles = new Set<string>()

  for (const line of output.split('\n')) {
    const event = parseJsonLine(line)
    if (!event) {
      if (!finalResponse && line.trim().length > 0) {
        finalResponse = line.trim()
      }
      continue
    }

    if (event.type === 'result') {
      finalResponse =
        typeof event.result === 'string' ? event.result : finalResponse
      isError = event.is_error === true
      changedFiles.clear()
    } else {
      const text = textFromEvent(event)
      if (text) {
        finalResponse = text
      }
    }

    for (const file of filesFromEvent(event)) {
      changedFiles.add(file)
    }
  }

  return {
    finalResponse: finalResponse || 'Done.',
    changedFiles: [...changedFiles],
    isError,
  }
}

export type { ParsedDirgeOutput }
export { parseDirgeOutput }
