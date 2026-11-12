export const captureException = (error: any, hint?: { data?: any }) => {
  if (import.meta.env.DEV) {
    console.error('[ErrorCaptured]', error, hint?.data)
  }
}

export const captureEvent = (event: any, hint?: { extra?: any }) => {
  if (import.meta.env.DEV) {
    console.log('[EventCaptured]', event, hint?.extra)
  }
}
