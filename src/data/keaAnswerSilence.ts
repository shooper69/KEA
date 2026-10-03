const STORAGE_KEY = 'kea-answer-silence-seconds'
const MIGRATED_KEY = 'kea-answer-silence-default-v2'

export const DEFAULT_ANSWER_SILENCE_SECONDS = 2
export const MIN_ANSWER_SILENCE_SECONDS = 1
export const MAX_ANSWER_SILENCE_SECONDS = 10

/** After the learner stops talking, wait this long, then start answering. */

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
    // One-time: old default was 3s — move devices still on that default to 2s.
    if (localStorage.getItem(MIGRATED_KEY) !== '1') {
      localStorage.setItem(MIGRATED_KEY, '1')
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw == null || raw === '' || Number(raw) === 3) {
        localStorage.setItem(STORAGE_KEY, String(DEFAULT_ANSWER_SILENCE_SECONDS))
        return DEFAULT_ANSWER_SILENCE_SECONDS
      }
    }
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
