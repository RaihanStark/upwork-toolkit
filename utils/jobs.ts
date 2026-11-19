import { storage } from '#imports'
import { Job } from '@/api/upwork'
import isFunction from 'lodash/isFunction'

const namespace = 'local:__JOBS'
const clearedNamespace = 'local:__CLEARED_JOBS'
const MAX_CLEARED_IDS = 500

const getAll = () => storage.getItem<Job[] | null>(namespace)

const getClearedIds = async (): Promise<string[]> =>
  (await storage.getItem<string[]>(clearedNamespace)) ?? []

const addClearedIds = async (ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return getClearedIds()
  const existing = await getClearedIds()
  const updated = Array.from(new Set([...ids, ...existing])).slice(
    0,
    MAX_CLEARED_IDS
  )
  await storage.setItem(clearedNamespace, updated)
  return updated
}

const save = async (arg: Job[] | ((jobs: Job[]) => Job[])): Promise<Job[]> => {
  const updatedState = isFunction(arg) ? arg((await getAll()) ?? []) : arg
  await storage.setItem(namespace, updatedState)
  return updatedState
}

const removeJob = async (ciphertext: string): Promise<Job[]> => {
  await addClearedIds([ciphertext])
  return save((jobs) => jobs.filter((job) => job.ciphertext !== ciphertext))
}

const clearAll = async (): Promise<Job[]> => {
  const currentJobs = (await getAll()) ?? []
  await addClearedIds(currentJobs.map((job) => job.ciphertext))
  return save([])
}

const addEventListener = (
  callback: (newJobs: Job[] | null, oldJobs: Job[] | null) => void
) => storage.watch<Job[]>(namespace, callback)

export default {
  addEventListener,
  clearAll,
  getAll,
  getClearedIds,
  removeJob,
  save,
}
