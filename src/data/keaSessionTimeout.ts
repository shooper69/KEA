/** How long Kea waits with no activity before signing out.
 * Keep timed options above the listen-idle window (default 10 minutes) so quiet
 * listening does not sign the user out before Kea herself goes idle.
 * 0 = never auto sign-out.
 */
export const SESSION_TIMEOUT_NEVER = 0

/** Learner default. Admins default to {@link SESSION_TIMEOUT_NEVER}. */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 30

export const DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES = SESSION_TIMEOUT_NEVER

export const SESSION_TIMEOUT_MINUTE_OPTIONS = [
  SESSION_TIMEOUT_NEVER,
  10,
  15,
  30,
  60,
] as const

export function normalizeSessionTimeoutMinutes(
  raw: unknown,
  fallback: number = DEFAULT_SESSION_TIMEOUT_MINUTES,
): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  const allowed = SESSION_TIMEOUT_MINUTE_OPTIONS as readonly number[]
  if (allowed.includes(n)) return n
  return fallback
}

export function isSessionTimeoutNever(minutes: number): boolean {
  return normalizeSessionTimeoutMinutes(minutes) === SESSION_TIMEOUT_NEVER
}

export function sessionTimeoutLabel(minutes: number): string {
  const value = normalizeSessionTimeoutMinutes(minutes)
  if (value === SESSION_TIMEOUT_NEVER) return 'Never'
  return value === 1 ? '1 minute' : `${value} minutes`
}

export function defaultSessionTimeoutMinutes(isAdmin: boolean): number {
  return isAdmin
    ? DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES
    : DEFAULT_SESSION_TIMEOUT_MINUTES
}
