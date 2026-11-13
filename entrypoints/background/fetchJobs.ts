import { browser } from '#imports'
import mobileNotificationsApi from '@/api/mobileNotifications'
import upworkApi, { Job } from '@/api/upwork'
import colors from '@/utils/colors'
import { ErrorType } from '@/utils/errors'
import extension from '@/utils/extension'
import stateStorage from '@/utils/globalState'
import jobStorage from '@/utils/jobs'
import logger from '@/utils/logger'
import notifications from '@/utils/notifications'
import { captureEvent, captureException } from '@/utils/sentry'
import { format } from 'date-fns'
import { v4 } from 'uuid'

const getErrorType = (error: any): ErrorType => {
  switch (true) {
    case upworkApi.isServerError(error):
      return ErrorType.SERVER_ERROR
    case upworkApi.isUnauthenticatedError(error):
      return ErrorType.UNAUTHENTICATED
    case upworkApi.isNetworkError(error):
      return ErrorType.NETWORK_ERROR
    case upworkApi.isForbiddenError(error):
    case upworkApi.isRateLimitError(error):
      return ErrorType.FORBIDDEN
    default:
      return ErrorType.OTHER
  }
}

const fetchJobs = async () => {
  const cycleId = v4().split('-').shift() as string
  const globalState = await stateStorage.get()

  // This check makes sure that background script doesn't run twice.
  // E.g. after system waking up.
  if (globalState.lastCycleStartedAt + 30 * 1000 > Date.now()) {
    await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Another cycle is already running, exiting...',
    ])
    return
  }

  await stateStorage.save({ lastCycleStartedAt: Date.now() })

  if (!globalState.enabled) {
    await Promise.all([
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        'Extension is disabled, exiting...',
      ]),
      browser.action.setBadgeText({ text: 'OFF' }),
      browser.action.setBadgeBackgroundColor({ color: colors.orange }),
    ])
    return
  }

  const oldBatch = await jobStorage.getAll()
  let newBatch: Job[] = []

  try {
    newBatch = await upworkApi.getJobs(globalState.feedType)
  } catch (error: any) {
    const errorType = getErrorType(error)

    if (
      errorType === ErrorType.UNAUTHENTICATED &&
      globalState.lastCycleError !== ErrorType.UNAUTHENTICATED
    ) {
      await notifications.show({
        type: 'basic',
        iconUrl: 'empty-icon.png',
        title: 'Your Upwork session has ended.',
        message: 'Please login to keep extension working.',
      })
    }

    await Promise.all([
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        `${errorType}, exiting...`,
      ]),

      stateStorage.save({ lastCycleError: errorType }),

      errorType === ErrorType.OTHER &&
        !upworkApi.shouldIgnoreError(error) &&
        captureException(error),

      browser.action.setBadgeText({ text: 'ERR' }),
      browser.action.setBadgeBackgroundColor({ color: colors.error }),
    ])
    return
  }

  if (oldBatch && !Array.isArray(oldBatch)) {
    captureEvent({ message: 'oldBatch is not an array', extra: { oldBatch } })
  }

  const existingBatch = Array.isArray(oldBatch) ? oldBatch : []
  const oldBatchIds = existingBatch.map((job) => job.ciphertext)
  const newJobs = newBatch.filter(
    (job) => !oldBatchIds.includes(job.ciphertext)
  )

  const JOB_STALE_TTL_MS = 5 * 60 * 1000 // 5 minutes
  const now = Date.now()

  // 1. Process all incoming fresh jobs from Upwork:
  // Update existing jobs with fresh Upwork metadata, while preserving local user state
  const freshProcessed = newBatch.map((freshJob) => {
    const existing = existingBatch.find(
      (oldJob) => oldJob.ciphertext === freshJob.ciphertext
    )
    if (existing) {
      return {
        ...freshJob,
        isStale: false,
        lastSyncedAt: now,
        __isSeen: existing.__isSeen,
        connectPrice: existing.connectPrice ?? freshJob.connectPrice,
      }
    }
    return {
      ...freshJob,
      isStale: false,
      lastSyncedAt: now,
      __isSeen: false,
    }
  })

  // 2. Keep older jobs that were in oldBatch but outside the latest 10-job batch
  const freshIds = new Set(newBatch.map((j) => j.ciphertext))
  const olderJobs = existingBatch
    .filter((oldJob) => !freshIds.has(oldJob.ciphertext))
    .map((oldJob) => {
      const isStale =
        !oldJob.lastSyncedAt || now - oldJob.lastSyncedAt > JOB_STALE_TTL_MS
      return {
        ...oldJob,
        isStale,
      }
    })

  // 3. Combine fresh batch at top with older jobs history (expanded from 50 to 250)
  const newProcessedBatch = [...freshProcessed, ...olderJobs].slice(0, 250)

  const unseenJobs = newProcessedBatch.filter((job) => !job.__isSeen)
  const unseenCount = unseenJobs.length

  const hasNewUnseenJobs =
    unseenJobs.length > 0 &&
    unseenJobs.some((job) => !oldBatchIds.includes(job.ciphertext))

  await Promise.all([
    jobStorage.save(newProcessedBatch),
    stateStorage.save({ lastCycleError: null }),

    browser.action.setBadgeText({ text: String(unseenCount || '') }),
    browser.action.setBadgeBackgroundColor({ color: colors.warning }),

    !hasNewUnseenJobs &&
      logger.info([
        extension.Cycles.FETCH_JOBS,
        cycleId,
        'No new jobs, exiting...',
      ]),
  ])

  if (!hasNewUnseenJobs) return

  const currentDay = new Date().getDay()
  const currentTime = format(new Date(), 'HH:mm:ss')

  if (
    globalState.schedulingEnabled &&
    globalState.schedules.length > 0 &&
    !globalState.schedules.find(
      (schedule) =>
        schedule.days.includes(currentDay) &&
        format(new Date(schedule.from), 'HH:mm:00') <= currentTime &&
        format(new Date(schedule.to), 'HH:mm:59') >= currentTime
    )
  ) {
    return await logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      'Outside of working hours, exiting without notifying...',
    ])
  }

  const [{ created, clearedAll }] = await Promise.all([
    notifications.show(
      {
        type: 'basic',
        iconUrl: 'empty-icon.png', // Bug, should not be required
        title: `You have ${unseenCount} new job${unseenCount > 1 ? 's' : ''}`,
        message: 'Click to apply!',
      },
      globalState.soundSettings
    ),
    // Also relay this cycle's new jobs to the user's phone (Telegram / ntfy /
    // webhook), if configured. Fire-and-forget: failures are swallowed and
    // never affect the desktop path.
    mobileNotificationsApi.send({ count: newJobs.length, jobs: newJobs }),
    logger.info([
      extension.Cycles.FETCH_JOBS,
      cycleId,
      `New counter: ${unseenCount}. Notifying...`,
    ]),
  ])

  await logger.info([
    extension.Cycles.FETCH_JOBS,
    cycleId,
    `created: ${created} / clearedAll: ${clearedAll ? 'true' : 'false'}`,
  ])
}

export default fetchJobs
