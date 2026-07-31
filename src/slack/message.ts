const stripMentions = (text: string): string => {
  return text.replace(/<@[A-Z0-9]+>/g, '').trim()
}

const mentionsBot = (options: { text: string; botUserId: string }): boolean => {
  return options.text.includes(`<@${options.botUserId}>`)
}

const chunkSlack = (options: { text: string; limit?: number }): string[] => {
  const limit = options.limit ?? 3500
  const chunks: string[] = []
  let rest = options.text

  while (rest.length > limit) {
    const cut = Math.max(
      rest.lastIndexOf('\n', limit),
      rest.lastIndexOf(' ', limit),
      limit,
    )
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }

  if (rest.length > 0) {
    chunks.push(rest)
  }
  return chunks
}

export { chunkSlack, mentionsBot, stripMentions }
