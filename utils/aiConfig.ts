import { storage } from '#imports'

export type AiProvider = 'gemini' | 'openai'

export type AiConfig = {
  provider: AiProvider
  geminiApiKey: string
  openaiApiKey: string
  geminiModel: string
  openaiModel: string
}

export type ActiveAiConfig = {
  provider: AiProvider
  apiKey: string
  model: string
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

const PROVIDER_KEY = 'sync:__AI_PROVIDER'
const GEMINI_KEY = 'sync:__GEMINI_API_KEY'
const OPENAI_KEY = 'sync:__OPENAI_API_KEY'
const GEMINI_MODEL_KEY = 'sync:__GEMINI_MODEL'
const OPENAI_MODEL_KEY = 'sync:__OPENAI_MODEL'

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  openaiModel: DEFAULT_OPENAI_MODEL,
}

const get = async (): Promise<AiConfig> => {
  const [
    provider,
    geminiApiKeySync,
    geminiApiKeyLocal,
    openaiApiKeySync,
    openaiApiKeyLocal,
    geminiModel,
    openaiModel,
  ] = await Promise.all([
    storage.getItem<AiProvider>(PROVIDER_KEY),
    storage.getItem<string>(GEMINI_KEY, { fallback: '' }),
    storage.getItem<string>('local:__GEMINI_API_KEY', { fallback: '' }),
    storage.getItem<string>(OPENAI_KEY, { fallback: '' }),
    storage.getItem<string>('local:__OPENAI_API_KEY', { fallback: '' }),
    storage.getItem<string>(GEMINI_MODEL_KEY, {
      fallback: DEFAULT_GEMINI_MODEL,
    }),
    storage.getItem<string>(OPENAI_MODEL_KEY, {
      fallback: DEFAULT_OPENAI_MODEL,
    }),
  ])

  const geminiApiKey = (geminiApiKeySync || geminiApiKeyLocal || '').trim()
  const openaiApiKey = (openaiApiKeySync || openaiApiKeyLocal || '').trim()

  // If user hasn't explicitly set provider, default to OpenAI if they already
  // have an OpenAI key, otherwise default to Gemini.
  const determinedProvider: AiProvider =
    provider ?? (openaiApiKey && !geminiApiKey ? 'openai' : 'gemini')

  return {
    provider: determinedProvider,
    geminiApiKey,
    openaiApiKey,
    geminiModel: geminiModel?.trim() || DEFAULT_GEMINI_MODEL,
    openaiModel: openaiModel?.trim() || DEFAULT_OPENAI_MODEL,
  }
}

const save = async (patch: Partial<AiConfig>): Promise<AiConfig> => {
  const promises: Promise<unknown>[] = []

  if (patch.provider !== undefined) {
    promises.push(storage.setItem<AiProvider>(PROVIDER_KEY, patch.provider))
  }
  if (patch.geminiApiKey !== undefined) {
    const trimmed = patch.geminiApiKey.trim()
    promises.push(storage.setItem<string>(GEMINI_KEY, trimmed))
    promises.push(storage.setItem<string>('local:__GEMINI_API_KEY', trimmed))
  }
  if (patch.openaiApiKey !== undefined) {
    const trimmed = patch.openaiApiKey.trim()
    promises.push(storage.setItem<string>(OPENAI_KEY, trimmed))
    promises.push(storage.setItem<string>('local:__OPENAI_API_KEY', trimmed))
  }
  if (patch.geminiModel !== undefined) {
    promises.push(
      storage.setItem<string>(
        GEMINI_MODEL_KEY,
        patch.geminiModel.trim() || DEFAULT_GEMINI_MODEL
      )
    )
  }
  if (patch.openaiModel !== undefined) {
    promises.push(
      storage.setItem<string>(
        OPENAI_MODEL_KEY,
        patch.openaiModel.trim() || DEFAULT_OPENAI_MODEL
      )
    )
  }

  await Promise.all(promises)
  return get()
}

const getActive = async (): Promise<ActiveAiConfig> => {
  const config = await get()

  let provider = config.provider
  let apiKey = provider === 'gemini' ? config.geminiApiKey : config.openaiApiKey

  // Fallback: if active provider has no key, but the other provider does, use the other provider!
  if (!apiKey) {
    if (provider === 'gemini' && config.openaiApiKey) {
      provider = 'openai'
      apiKey = config.openaiApiKey
    } else if (provider === 'openai' && config.geminiApiKey) {
      provider = 'gemini'
      apiKey = config.geminiApiKey
    }
  }

  const model =
    provider === 'gemini'
      ? config.geminiModel || DEFAULT_GEMINI_MODEL
      : config.openaiModel || DEFAULT_OPENAI_MODEL

  return {
    provider,
    apiKey,
    model,
  }
}

export default { get, save, getActive }
