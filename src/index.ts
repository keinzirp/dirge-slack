import { access } from 'node:fs/promises'
import type { SlackEventMiddlewareArgs } from '@slack/bolt'
import { App } from '@slack/bolt'
import { cleanupClosedPrWorktrees } from '#src/cleanup.ts'
import { installDirgeRuntime, verifySlackPlugin } from '#src/dirge/index.ts'
import { getConfig } from '#src/env.ts'
import { git } from '#src/git/index.ts'
import { runCodeJob, runReadJob } from '#src/job.ts'
import { createJobQueue } from '#src/queue/job-queue.ts'
import {
  classifyJob,
  replyChunks,
  safeReaction,
  stripMentions,
} from '#src/slack/index.ts'
import { createSessionStore } from '#src/state/session.ts'

type AppMentionEvent = SlackEventMiddlewareArgs<'app_mention'>['event'] & {
  team?: string
}

type BodyWithEventId = {
  event_id?: string
  team_id?: string
}

const allowed = (options: {
  channelId: string
  userId: string
  allowedChannels: ReadonlySet<string>
  allowedUsers: ReadonlySet<string>
}): boolean => {
  return (
    options.allowedChannels.has(options.channelId) &&
    options.allowedUsers.has(options.userId)
  )
}

const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const main = async () => {
  const config = getConfig()
  await access(config.git.workdir)
  await git({ cwd: config.git.workdir, args: ['worktree', 'prune'] })

  const store = createSessionStore({ stateDir: config.git.stateDir })
  await store.load()
  await cleanupClosedPrWorktrees({ store, config })
  await store.save()

  await installDirgeRuntime({ configDir: config.dirge.configDir })
  await verifySlackPlugin({ cwd: config.git.workdir, config: config.dirge })

  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
  })
  const queue = createJobQueue()

  app.event('app_mention', async ({ event, body, client }) => {
    const mention = event as AppMentionEvent
    const bodyWithEventId = body as BodyWithEventId
    const eventId = bodyWithEventId.event_id

    if (eventId && store.wasSeenEvent(eventId)) {
      return
    }
    if (eventId) {
      store.rememberEvent(eventId)
      await store.save()
    }

    if (!mention.user || mention.bot_id) {
      return
    }
    if (
      !allowed({
        channelId: mention.channel,
        userId: mention.user,
        allowedChannels: config.slack.allowedChannels,
        allowedUsers: config.slack.allowedUsers,
      })
    ) {
      return
    }

    const prompt = stripMentions(mention.text ?? '')
    const threadTs = mention.thread_ts ?? mention.ts
    const teamId = bodyWithEventId.team_id ?? mention.team ?? 'unknown-team'
    const thread = store.getOrCreate({
      teamId,
      channelId: mention.channel,
      threadTs,
    })
    await store.save()

    if (/^cancel\b/i.test(prompt)) {
      const result = queue.cancelThread({
        channelId: mention.channel,
        threadTs,
      })
      await safeReaction({
        client,
        action: 'remove',
        name: 'hourglass_flowing_sand',
        channelId: mention.channel,
        messageTs: mention.ts,
      })
      await safeReaction({
        client,
        action: 'remove',
        name: 'eyes',
        channelId: mention.channel,
        messageTs: mention.ts,
      })
      await replyChunks({
        client,
        channelId: mention.channel,
        threadTs,
        text:
          result.cancelledActive || result.removedQueued > 0
            ? 'Cancelled.'
            : 'Nothing to cancel.',
      })
      return
    }

    const kind = classifyJob(prompt)
    const wasQueued = queue.enqueue({
      id: eventId ?? `${mention.channel}:${mention.ts}`,
      channelId: mention.channel,
      threadTs,
      run: async (signal) => {
        if (wasQueued) {
          await safeReaction({
            client,
            action: 'remove',
            name: 'hourglass_flowing_sand',
            channelId: mention.channel,
            messageTs: mention.ts,
          })
        }
        await safeReaction({
          client,
          action: 'add',
          name: 'eyes',
          channelId: mention.channel,
          messageTs: mention.ts,
        })

        try {
          const text =
            kind === 'code'
              ? await runCodeJob({ prompt, thread, config, signal })
              : await runReadJob({
                  prompt,
                  sessionId: thread.sessionId,
                  config,
                  signal,
                })
          await store.save()
          await replyChunks({
            client,
            channelId: mention.channel,
            threadTs,
            text,
          })
        } catch (error) {
          await replyChunks({
            client,
            channelId: mention.channel,
            threadTs,
            text: `Failed: ${errorMessage(error)}`,
          })
        } finally {
          await safeReaction({
            client,
            action: 'remove',
            name: 'eyes',
            channelId: mention.channel,
            messageTs: mention.ts,
          })
        }
      },
    })

    if (wasQueued) {
      await safeReaction({
        client,
        action: 'add',
        name: 'hourglass_flowing_sand',
        channelId: mention.channel,
        messageTs: mention.ts,
      })
    }
  })

  await app.start()
  console.info('dirge-slack connected')
}

await main()
