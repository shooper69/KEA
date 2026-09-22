const STORAGE_KEY = 'kea-average-reply-words'
export const DEFAULT_AVERAGE_REPLY_WORDS = 30
export const MIN_AVERAGE_REPLY_WORDS = 8
export const MAX_AVERAGE_REPLY_WORDS = 120

export function clampAverageReplyWords(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_AVERAGE_REPLY_WORDS
  return Math.min(
    MAX_AVERAGE_REPLY_WORDS,
    Math.max(MIN_AVERAGE_REPLY_WORDS, Math.round(n)),
  )
}

export function getAverageReplyWords(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return DEFAULT_AVERAGE_REPLY_WORDS
    return clampAverageReplyWords(Number(raw))
  } catch {
    return DEFAULT_AVERAGE_REPLY_WORDS
  }
}

export function saveAverageReplyWords(value: number) {
  localStorage.setItem(
    STORAGE_KEY,
    String(clampAverageReplyWords(value)),
  )
}

export function maxTokensForAverageWords(words: number) {
  const n = clampAverageReplyWords(words)
  return Math.min(480, Math.max(48, Math.round(n * 4) + 40))
}
