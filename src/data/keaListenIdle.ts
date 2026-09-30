/** How long Kea stays live on the chat page after the latest activity
 * (opening chat, speaking, or a reply turn). Default 10 minutes. */

export const DEFAULT_LISTEN_IDLE_SECONDS = 600 // 10 minutes
export const MIN_LISTEN_IDLE_SECONDS = 60 // 1 minute
export const MAX_LISTEN_IDLE_SECONDS = 30 * 60 // 30 minutes

/** Settings choices (minutes). 10 is the default. */
export const LISTEN_IDLE_MINUTE_OPTIONS = [1, 2, 5, 10, 15, 20, 30] as const

export function normalizeListenIdleSeconds(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LISTEN_IDLE_SECONDS
  // Legacy settings stored 5–59 seconds of quiet. Promote those to 10 minutes.
  if (n < MIN_LISTEN_IDLE_SECONDS) return DEFAULT_LISTEN_IDLE_SECONDS
  return Math.min(MAX_LISTEN_IDLE_SECONDS, Math.max(MIN_LISTEN_IDLE_SECONDS, Math.round(n)))
}

export function listenIdleLabel(seconds: number): string {
  const minutes = Math.round(normalizeListenIdleSeconds(seconds) / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
