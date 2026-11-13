import { browser, type Browser } from '#imports'
import { ErrorType } from '@/utils/errors'
import logger from '@/utils/logger'
import { captureException } from '@/utils/sentry'
import timer from '@/utils/timer'
import axios, { AxiosResponse } from 'axios'
import isString from 'lodash/isString'

import { bestMatchesQuery, mostRecentQuery, myFeedQuery } from './gqlQueries'

import { BestMatches as BestMatchesResponseType } from './responses/BestMatches'
import { MostRecent as MostRecentResponseType } from './responses/MostRecent'
import { MyFeed } from './responses/MyFeed'

type MyFeedErrorResponse = {
  data: {
    userSavedSearches: null
  }
}

type MyFeedResponseType = MyFeed | MyFeedErrorResponse

export type Job = {
  title: string
  type: string
  tierText: string | null
  description: string
  engagement: string | null
  durationLabel: string | null
  proposalsTier: string | null
  clientRelation: null | string

  amount: {
    amount: string
  }

  hourlyBudget: {
    min: number
    max: number
  }

  client?: {
    paymentVerificationStatus: number | null
    totalFeedback: number
    totalSpent: number
    totalHires?: number
    totalPostedJobs?: number
    openJobsCount?: number
    openJobs?: number

    location?: {
      country: string | null
    }
  }
  attrs?: {
    prettyName: string | null
  }[]

  /**
   * Unique identifier
   */
  ciphertext: string
  connectPrice?: number
  isStale?: boolean
  lastSyncedAt?: number
  duration: string | null
  renewedOn: Date | null
  createdOn: Date | string

  // internal attribute
  __isSeen: boolean
}

export type ClientStats = {
  hireRate: number
  openJobs: number
  totalPostedJobs: number
  totalHires: number
  formatted: string
}

export const getClientStats = (client: Job['client']): ClientStats | null => {
  if (!client) return null

  const totalPosted =
    client.totalPostedJobs ?? (client.totalHires ? client.totalHires : 0)
  const totalHires = client.totalHires ?? 0
  const hireRate =
    totalPosted > 0
      ? Math.min(Math.round((totalHires / totalPosted) * 100), 100)
      : 0
  const openJobs = client.openJobsCount ?? client.openJobs ?? 1

  const openJobsText = `${openJobs} open job${openJobs === 1 ? '' : 's'}`
  const postedText = `${totalPosted} job${totalPosted === 1 ? '' : 's'} posted`
  const formatted = `${hireRate}% hire rate, ${openJobsText}, ${postedText}`

  return {
    hireRate,
    openJobs,
    totalPostedJobs: totalPosted,
    totalHires,
    formatted,
  }
}

const api = axios.create({
  adapter: 'fetch',
  withCredentials: true,
  baseURL: 'https://www.upwork.com',
})

api.interceptors.response.use(logger.logRequest)

const pageHeaders = {
  'Cache-Control': 'no-cache',
  Accept: [
    'text/html',
    'application/xhtml+xml',
    'application/xml;q=0.9',
    'image/avif',
    'image/webp',
    'image/apng',
    '*/*;q=0.8',
    'application/signed-exchange;v=b3;q=0.9',
  ].join(', '),
  'Accept-Encoding': ['gzip', 'deflate', 'br'].join(', '),
  'X-Requested-With': 'XMLHttpRequest',
}

export enum FeedType {
  MostRecent = 'Most Recent',
  BestMatches = 'Best Matches',
  MyFeed = 'My Feed / Saved Searches',
}

type FeedOptions = Record<
  FeedType,
  {
    pageUrl: string
    description: string
    query?: string
  }
>

const feedOptions: FeedOptions = {
  [FeedType.MyFeed]: {
    pageUrl: 'https://www.upwork.com/nx/find-work',
    description:
      'Jobs that match your personal preferences/filters <strong>(configurable)</strong>.',
    query: myFeedQuery,
  },
  [FeedType.BestMatches]: {
    pageUrl: 'https://www.upwork.com/nx/find-work/best-matches',
    description:
      "Jobs that match your experience to a client's hiring preferences <strong>(not configurable)</strong>. Ordered by most relevant.",
    query: bestMatchesQuery,
  },
  [FeedType.MostRecent]: {
    pageUrl: 'https://www.upwork.com/nx/find-work/most-recent',
    description:
      'The most recent jobs that match your skills and profile description to the skills clients are looking for <strong>(not configurable)</strong>.',
    query: mostRecentQuery,
  },
}

const getCookieToken = async (props: {
  path: string
  shouldTryAgain?: boolean
  triggerCookieToken: () => Promise<AxiosResponse>
}): Promise<Browser.cookies.Cookie | null> => {
  const { shouldTryAgain = true, triggerCookieToken, path } = props

  const cookies = await browser.cookies.getAll({ path })

  const cookie = cookies.length
    ? cookies.reduce(
        (result: Browser.cookies.Cookie, current: Browser.cookies.Cookie) =>
          (current.expirationDate as number) > (result.expirationDate as number)
            ? current
            : result
      )
    : null

  if (
    cookie &&
    cookie.expirationDate &&
    cookie.expirationDate * 1000 > Date.now()
  ) {
    return cookie
  }

  if (!shouldTryAgain) {
    return null
  }

  await removeCookies(props.path)
  await triggerCookieToken()
  await timer.resolveIn(5000)

  const triggerResponse = await triggerCookieToken()
  if (
    isString(triggerResponse.data.action) &&
    triggerResponse.data.action.startsWith(
      'https://www.upwork.com/ab/account-security/login'
    )
  ) {
    return null
  }

  return getCookieToken({ ...props, shouldTryAgain: false })
}

const getJobsToken = () =>
  getCookieToken({
    path: '/nx/find-work/',
    triggerCookieToken: () =>
      api.get('nx/find-work/', { headers: pageHeaders }),
  })

const removeCookies = async (path: string) => {
  const cookies = await browser.cookies.getAll({ path })

  await Promise.all(
    cookies.map((c) =>
      browser.cookies.remove({
        name: c.name,
        url: `https://upwork.com${c.path}`,
      })
    )
  )
}

const requestJobs = async (
  cookie: Browser.cookies.Cookie,
  feedType: FeedType
): Promise<Job[]> => {
  const headers = {
    Authorization: cookie ? `bearer ${cookie.value}` : false,
    'X-Requested-With':
      feedType === FeedType.MostRecent ? 'XMLHttpRequest' : false,
  }

  if (feedType === FeedType.MyFeed) {
    const response = await api.post<MyFeedResponseType | MyFeedErrorResponse>(
      'api/graphql/v1',
      {
        query: feedOptions[FeedType.MyFeed].query,
        variables: { queryParams: {} },
      },
      { headers }
    )

    if (!response.data?.data?.userSavedSearches) {
      captureException(new Error('response.data.data is undefined'), {
        data: { response },
      })
      return []
    }

    return response.data.data.userSavedSearches.results.map((job) => ({
      ...job,
      __isSeen: false,
      tierText: job.contractorTier,
      type: job.type === 'FIXED' ? 'Fixed-price' : 'Hourly',
      client: {
        ...job.client,
        totalSpent: Number.parseFloat(
          job.client.totalSpent ? job.client.totalSpent.displayValue : ''
        ),
      },
    }))
  }

  if (feedType === FeedType.BestMatches) {
    const response = await api.post<BestMatchesResponseType>(
      'api/graphql/v1',
      {
        query: feedOptions[FeedType.BestMatches].query,
        variables: { fromTime: 0, toTime: 30 },
      },
      { headers }
    )

    if (!response.data?.data?.bestMatchJobsFeed) {
      captureException(new Error('response.data.data is undefined'), {
        data: { response },
      })
      return []
    }

    return response.data.data.bestMatchJobsFeed.results.map((job) => ({
      ...job,
      __isSeen: false,
      type: job.type === 1 ? 'Fixed-price' : 'Hourly',
      amount: {
        ...job.amount,
        amount: String(job.amount.amount),
      },
    }))
  }

  if (feedType === FeedType.MostRecent) {
    const response = await api.post<MostRecentResponseType>(
      'api/graphql/v1',
      {
        query: feedOptions[FeedType.MostRecent].query,
        variables: { limit: 10 },
      },
      { headers }
    )

    if (!response.data?.data?.mostRecentJobsFeed) {
      captureException(new Error('response.data.data is undefined'), {
        data: { response },
      })
      return []
    }

    return response.data.data.mostRecentJobsFeed.results.map((job) => ({
      ...job,
      __isSeen: false,
      durationLabel: job.duration,
      clientRelation: null,
      renewedOn: job.publishedOn,
      type: job.type === 1 ? 'Fixed-price' : 'Hourly',
      amount: {
        ...job.amount,
        amount: String(job.amount.amount),
      },
    }))
  }

  throw new Error('Invalid feed type')
}

const getJobs = async (feedType: FeedType) => {
  const cookie = await getJobsToken()

  if (!cookie) {
    throw new Error(ErrorType.UNAUTHENTICATED)
  }

  try {
    return await requestJobs(cookie, feedType)
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      await removeCookies('/nx/find-work/')
      const newCookie = await getJobsToken()

      if (!newCookie) {
        throw new Error(ErrorType.UNAUTHENTICATED)
      }

      return await requestJobs(newCookie, feedType)
    } else {
      throw error
    }
  }
}

const viewUrl = (id: string) => `https://upwork.com/jobs/${id}`

const proposalUrl = (id: string) =>
  `https://upwork.com/ab/proposals/job/${id}/apply`

const isUnauthenticatedError = (error: any) =>
  (axios.isAxiosError(error) && error.response?.status === 401) ||
  error?.message === ErrorType.UNAUTHENTICATED

const isForbiddenError = (error: any) =>
  axios.isAxiosError(error) && error.response?.status === 403

const isNetworkError = (error: any) =>
  axios.isAxiosError(error) && error.code === 'ERR_NETWORK'

const isServerError = (error: any) =>
  axios.isAxiosError(error) && error.response && error.response.status >= 500

const isRateLimitError = (error: any) =>
  axios.isAxiosError(error) && error.response && error.response.status === 429

const shouldIgnoreError = (error: any) =>
  axios.isAxiosError(error) &&
  error.response &&
  [400, 409, 499].includes(error.response.status)

const parseConnectPrice = (text: string): number | null => {
  if (!text || typeof text !== 'string') return null

  // 1. First priority: Exact proposal requirement text in HTML
  // E.g.: "Send a proposal for: 10 Connects", "Required Connects to submit a proposal: 10", "Required Connects: 10"
  const htmlPatterns = [
    /(?:send|submit)\s+a\s+proposal\s+for:?\s*(?:<[^>]+>)*\s*(\d+)\s*(?:<[^>]+>)*\s*connects/i,
    /required\s+connects(?:\s+to\s+submit\s+a\s+proposal)?\s*:\s*(?:<[^>]+>)*\s*(\d+)/i,
    /(\d+)\s*(?:<[^>]+>)*\s*connects\s*(?:<[^>]+>)*\s*(?:required|to\s+submit\s+a\s+proposal)/i,
  ]

  for (const regex of htmlPatterns) {
    const match = text.match(regex)
    if (match && match[1]) {
      const val = parseInt(match[1], 10)
      // Upwork proposal requirements are between 1 and 50 (reject wallet balances like 214)
      if (val > 0 && val <= 50) return val
    }
  }

  // 2. Second priority: JSON properties strictly representing the job's required connects
  // NOTE: Never match connectsCount or availableConnects which represent user wallet balance!
  const jsonKeyMatches = [
    /"requiredConnects"\s*:\s*(\d+)/i,
    /"connectPrice"\s*:\s*(\d+)/i,
    /"connectsRequired"\s*:\s*(\d+)/i,
  ]

  for (const regex of jsonKeyMatches) {
    const match = text.match(regex)
    if (match && match[1]) {
      const val = parseInt(match[1], 10)
      if (val > 0 && val <= 50) return val
    }
  }

  return null
}

export type JobLiveUpdates = {
  connects: number | null
  proposalsTier: string | null
}

const parseProposalsTier = (text: string): string | null => {
  if (!text || typeof text !== 'string') return null
  const jsonMatch = text.match(/"proposalsTier"\s*:\s*"([^"]+)"/i)
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].trim()
  }
  const htmlMatch = text.match(
    /proposals(?:\s+tier)?:\s*(?:<[^>]+>)*\s*([0-9+]+(?:\s+to\s+[0-9+]+)?|less than 5)/i
  )
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1].trim()
  }
  return null
}

const fetchJobLiveUpdates = async (
  ciphertext: string
): Promise<JobLiveUpdates> => {
  if (!ciphertext) return { connects: null, proposalsTier: null }

  let connects: number | null = null
  let proposalsTier: string | null = null

  // Step 1: Request the job posting page
  try {
    const response = await api.get(`jobs/${ciphertext}`, {
      headers: pageHeaders,
      validateStatus: (status) => status < 400,
    })

    if (response.data) {
      const dataStr =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data)
      connects = parseConnectPrice(dataStr)
      proposalsTier = parseProposalsTier(dataStr)
    }
  } catch (error) {
    logger.error(['fetchJobLiveUpdates', ciphertext, String(error)])
  }

  // Step 2: Fallback to proposal page if connects wasn't found
  if (connects === null) {
    try {
      const propResponse = await api.get(
        `nx/proposals/job/${ciphertext}/apply`,
        {
          headers: pageHeaders,
          validateStatus: (status) => status < 400,
        }
      )

      if (propResponse.data) {
        const dataStr =
          typeof propResponse.data === 'string'
            ? propResponse.data
            : JSON.stringify(propResponse.data)
        connects = parseConnectPrice(dataStr)
        if (!proposalsTier) {
          proposalsTier = parseProposalsTier(dataStr)
        }
      }
    } catch (error) {
      logger.error(['fetchJobLiveUpdates:fallback', ciphertext, String(error)])
    }
  }

  return { connects, proposalsTier }
}

const fetchJobConnects = async (ciphertext: string): Promise<number | null> => {
  const result = await fetchJobLiveUpdates(ciphertext)
  return result.connects
}

export default {
  fetchJobConnects,
  fetchJobLiveUpdates,
  getClientStats,
  getJobs,
  getJobsToken,
  feedOptions,
  isUnauthenticatedError,
  isForbiddenError,
  isNetworkError,
  isRateLimitError,
  isServerError,
  proposalUrl,
  shouldIgnoreError,
  viewUrl,
}
