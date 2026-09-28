/** How long Kea waits with no activity before signing out. */

export const DEFAULT_SESSION_TIMEOUT_MINUTES = 10

export const SESSION_TIMEOUT_MINUTE_OPTIONS = [5, 10, 15, 30, 60] as const

export function normalizeSessionTimeoutMinutes(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SESSION_TIMEOUT_MINUTES
  const allowed = SESSION_TIMEOUT_MINUTE_OPTIONS as readonly number[]
  if (allowed.includes(n)) return n
  return DEFAULT_SESSION_TIMEOUT_MINUTES
}

export function sessionTimeoutLabel(minutes: number): string {
  const value = normalizeSessionTimeoutMinutes(minutes)
  return value === 1 ? '1 minute' : `${value} minutes`
}
