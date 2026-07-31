import type { webApi } from '@slack/bolt'

import { chunkSlack } from './message.ts'

type SlackThreadOptions = {
  client: webApi.WebClient
  channelId: string
  threadTs: string
}

const safeReaction = async (options: {
  client: webApi.WebClient
  action: 'add' | 'remove'
  name: string
  channelId: string
  messageTs: string
}): Promise<void> => {
  const { client, action, name, channelId, messageTs } = options

  try {
    if (action === 'add') {
      await client.reactions.add({
        name,
        channel: channelId,
        timestamp: messageTs,
      })
      return
    }
    await client.reactions.remove({
      name,
      channel: channelId,
      timestamp: messageTs,
    })
  } catch {
    return
  }
}

const replyChunks = async (
  options: SlackThreadOptions & { text: string },
): Promise<void> => {
  const { client, channelId, threadTs, text } = options
  for (const chunk of chunkSlack({ text })) {
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: chunk,
    })
  }
}

export type { SlackThreadOptions }
export { replyChunks, safeReaction }
