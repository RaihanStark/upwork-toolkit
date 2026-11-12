import { AiProvider } from '@/utils/aiConfig'

export type GenerateCoverLetterProps = {
  apiKey: string
  prompt: string
  provider?: AiProvider
  model?: string
  signal?: AbortSignal
  onChunk: (chunk: string) => void
}

/**
 * Streams a cover letter from Google Gemini or OpenAI.
 * Each token is delivered through `onChunk` as it arrives.
 */
const generateCoverLetter = async (
  props: GenerateCoverLetterProps
): Promise<void> => {
  const trimmedKey = props.apiKey.trim()
  const provider =
    props.provider ?? (trimmedKey.startsWith('AIzaSy') ? 'gemini' : 'openai')

  let endpoint: string
  let headers: Record<string, string>
  let body: string

  if (provider === 'gemini') {
    const rawModel = props.model || 'gemini-2.0-flash'
    const cleanModel = rawModel.trim().replace(/^models\//, '')
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(trimmedKey)}`
    headers = {
      'Content-Type': 'application/json',
    }
    body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: props.prompt }],
        },
      ],
    })
  } else {
    const model = props.model || 'gpt-4o-mini'
    endpoint = 'https://api.openai.com/v1/chat/completions'
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${trimmedKey}`,
    }
    body = JSON.stringify({
      model: model.trim(),
      stream: true,
      messages: [{ role: 'user', content: props.prompt }],
    })
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: props.signal,
    headers,
    body,
  })

  if (!response.ok || !response.body) {
    const rawDetails = await response.text().catch(() => '')
    let errorMessage = rawDetails

    try {
      const parsed = JSON.parse(rawDetails)
      const errObj = Array.isArray(parsed) ? parsed[0]?.error : parsed.error
      if (errObj?.message) {
        errorMessage = errObj.message
      }
    } catch {
      // Use rawDetails if not JSON
    }

    const providerName = provider === 'gemini' ? 'Google Gemini' : 'OpenAI'
    throw new Error(
      `${providerName} error (${response.status}): ${errorMessage}`
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let hasReceivedContent = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const data = trimmed.slice('data:'.length).trim()
      if (data === '[DONE]') return

      let content: string | undefined
      try {
        const parsed = JSON.parse(data)
        content =
          parsed.candidates?.[0]?.content?.parts?.[0]?.text ??
          parsed.choices?.[0]?.delta?.content
      } catch {
        // Ignore keep-alive comments and partially-buffered JSON.
      }

      if (content) {
        hasReceivedContent = true
        props.onChunk(content)
      }
    }
  }

  if (!hasReceivedContent) {
    const providerName = provider === 'gemini' ? 'Google Gemini' : 'OpenAI'
    throw new Error(`${providerName} stream ended before completion`)
  }
}

export default { generateCoverLetter }
