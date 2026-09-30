/**
 * Narrow public allowance for welcome-page marketing only.
 * Full chat / Whisper always need a signed-in session.
 */

const PUBLIC_PLAIN_TRANSLATE_MAX = 400
const PUBLIC_TTS_MAX = 400

/** Welcome marketing translate — short, single string, no chat history. */
export function isPublicPlainTranslateAllowed(payload: {
  mode?: string
  text?: string
  messages?: unknown
}): boolean {
  if (payload.mode !== 'plain-translate') return false
  if (Array.isArray(payload.messages) && payload.messages.length > 0) return false
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  return text.length > 0 && text.length <= PUBLIC_PLAIN_TRANSLATE_MAX
}

/** Welcome marketing speech — short lines only. */
export function isPublicTtsAllowed(text: string): boolean {
  const spoken = text.trim()
  return spoken.length > 0 && spoken.length <= PUBLIC_TTS_MAX
}
