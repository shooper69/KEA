const STORAGE_KEY = 'kea-answer-silence-seconds'

/** Was 5 seconds; a little quicker so Kea answers sooner after you pause. */
export const DEFAULT_ANSWER_SILENCE_SECONDS = 3
export const MIN_ANSWER_SILENCE_SECONDS = 1
export const MAX_ANSWER_SILENCE_SECONDS = 10

export function clampAnswerSilenceSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_ANSWER_SILENCE_SECONDS
  return Math.min(
    MAX_ANSWER_SILENCE_SECONDS,
    Math.max(MIN_ANSWER_SILENCE_SECONDS, Math.round(n)),
  )
}

export function getAnswerSilenceSeconds(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null || raw === '') return DEFAULT_ANSWER_SILENCE_SECONDS
    return clampAnswerSilenceSeconds(Number(raw))
  } catch {
    return DEFAULT_ANSWER_SILENCE_SECONDS
  }
}

export function saveAnswerSilenceSeconds(value: number) {
  localStorage.setItem(
    STORAGE_KEY,
    String(clampAnswerSilenceSeconds(value)),
  )
}

export function resetAnswerSilenceSeconds() {
  localStorage.removeItem(STORAGE_KEY)
}
