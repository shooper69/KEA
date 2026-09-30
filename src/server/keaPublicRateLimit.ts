/**
 * In-memory rate limits for Kea spendy routes.
 * Resets per Netlify/Vite function instance — still cuts casual abuse.
 */

const buckets = new Map<string, { count: number; resetAt: number }>()

export function allowRate(
  key: string,
  limit: number,
  windowMs = 60_000,
): boolean {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

/** @deprecated use allowRate — kept for existing public call sites */
export function allowPublicSpend(
  key: string,
  limit: number,
  windowMs = 60_000,
): boolean {
  return allowRate(key, limit, windowMs)
}

export function clientIpFromHeaders(
  headers: Record<string, string | undefined> | undefined,
): string {
  if (!headers) return 'unknown'
  const forwarded =
    headers['x-forwarded-for'] ||
    headers['X-Forwarded-For'] ||
    headers['x-nf-client-connection-ip'] ||
    headers['client-ip']
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return 'unknown'
}

/** Per signed-in user (and IP) — chat reply spend. */
export const AUTH_CHAT_LIMIT = 60
/** Per signed-in user — OpenAI TTS. */
export const AUTH_TTS_LIMIT = 40
/** Per signed-in user — Whisper. */
export const AUTH_TRANSCRIBE_LIMIT = 40

export const MAX_AUTH_TTS_CHARS = 2_000
export const MAX_CHAT_MESSAGE_CHARS = 2_000
export const MAX_CHAT_MESSAGES = 24
export const MAX_CHAT_TOTAL_CHARS = 12_000

export function allowAuthenticatedChat(userId: string, ip: string) {
  return (
    allowRate(`chat-user:${userId}`, AUTH_CHAT_LIMIT) &&
    allowRate(`chat-ip:${ip}`, AUTH_CHAT_LIMIT * 2)
  )
}

export function allowAuthenticatedTts(userId: string, ip: string) {
  return (
    allowRate(`tts-user:${userId}`, AUTH_TTS_LIMIT) &&
    allowRate(`tts-ip:${ip}`, AUTH_TTS_LIMIT * 2)
  )
}

export function allowAuthenticatedTranscribe(userId: string, ip: string) {
  return (
    allowRate(`whisper-user:${userId}`, AUTH_TRANSCRIBE_LIMIT) &&
    allowRate(`whisper-ip:${ip}`, AUTH_TRANSCRIBE_LIMIT * 2)
  )
}

export function chatPayloadTooLarge(payload: {
  text?: string
  messages?: Array<{ content?: string }>
}): string | null {
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (text.length > MAX_CHAT_MESSAGE_CHARS) {
    return 'That message is too long.'
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : []
  if (messages.length > MAX_CHAT_MESSAGES) {
    return 'Chat history is too long.'
  }
  let total = text.length
  for (const item of messages) {
    const content = typeof item?.content === 'string' ? item.content : ''
    if (content.length > MAX_CHAT_MESSAGE_CHARS) {
      return 'A chat turn is too long.'
    }
    total += content.length
  }
  if (total > MAX_CHAT_TOTAL_CHARS) {
    return 'Chat payload is too large.'
  }
  return null
}
