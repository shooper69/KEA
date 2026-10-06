const STORAGE_KEY = 'kea-answer-silence-seconds'
const MIGRATED_KEY = 'kea-answer-silence-default-v5'

/** Quiet time after the learner stops before Kea starts her reply. */
export const DEFAULT_ANSWER_SILENCE_SECONDS = 6
export const MIN_ANSWER_SILENCE_SECONDS = 0.5
export const MAX_ANSWER_SILENCE_SECONDS = 15

/** Settings choices — lower = she answers sooner. */
export const ANSWER_SILENCE_SECOND_OPTIONS = [
  0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15,
] as const

/** After the learner stops talking, wait this long, then start answering. */

export function clampAnswerSilenceSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_ANSWER_SILENCE_SECONDS
  // Snap to 0.5s steps so half-second options stay stable.
  const stepped = Math.round(n * 2) / 2
  return Math.min(
    MAX_ANSWER_SILENCE_SECONDS,
    Math.max(MIN_ANSWER_SILENCE_SECONDS, stepped),
  )
}

export function answerSilenceLabel(seconds: number): string {
  const n = clampAnswerSilenceSeconds(seconds)
  if (n === 0.5) return '0.5 seconds (fastest)'
  if (n === 1) return '1 second'
  return `${n} seconds`
}

export function getAnswerSilenceSeconds(): number {
  try {
    // One-time: anything under 6s was cutting in while the learner was still talking.
    // After this runs, a settings change (including a faster wait) is kept.
    if (localStorage.getItem(MIGRATED_KEY) !== '1') {
      localStorage.setItem(MIGRATED_KEY, '1')
      const raw = localStorage.getItem(STORAGE_KEY)
      const n = Number(raw)
      if (raw == null || raw === '' || !Number.isFinite(n) || n < DEFAULT_ANSWER_SILENCE_SECONDS) {
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
