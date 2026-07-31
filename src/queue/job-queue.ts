type QueuedJob = {
  id: string
  channelId: string
  threadTs: string
  run: (signal: AbortSignal) => Promise<void>
}

type CancelResult = {
  removedQueued: number
  cancelledActive: boolean
}

type JobQueue = {
  enqueue: (job: QueuedJob) => boolean
  cancelThread: (options: {
    channelId: string
    threadTs: string
  }) => CancelResult
}

const createJobQueue = (): JobQueue => {
  const queue: QueuedJob[] = []
  let active: { job: QueuedJob; controller: AbortController } | undefined

  const drain = async () => {
    if (active) {
      return
    }

    const job = queue.shift()
    if (!job) {
      return
    }

    const controller = new AbortController()
    active = { job, controller }
    try {
      await job.run(controller.signal)
    } finally {
      active = undefined
      queueMicrotask(() => void drain())
    }
  }

  return {
    enqueue: (job) => {
      const queued = Boolean(active) || queue.length > 0
      queue.push(job)
      queueMicrotask(() => void drain())
      return queued
    },

    cancelThread: ({ channelId, threadTs }) => {
      const before = queue.length
      const filtered = queue.filter(
        (job) => job.channelId !== channelId || job.threadTs !== threadTs,
      )
      queue.length = 0
      queue.push(...filtered)

      const activeJob = active
      const cancelledActive =
        activeJob?.job.channelId === channelId &&
        activeJob.job.threadTs === threadTs
      if (cancelledActive) {
        activeJob.controller.abort()
      }

      return {
        removedQueued: before - queue.length,
        cancelledActive,
      }
    },
  }
}

export type { CancelResult, JobQueue, QueuedJob }
export { createJobQueue }
