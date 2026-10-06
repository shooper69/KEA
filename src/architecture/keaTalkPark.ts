/**
 * When the user leaves the chat page while Kea is live, park the session:
 * mic stops, but returning to chat resumes listening without a wake prompt
 * and restarts the stay-live idle window.
 */

const PARK_KEY = 'kea-talk-parked-v1'
/** Survives React strict-mode’s extra mount so the flag is not consumed twice. */
let parkedLatch: boolean | null = null

export function parkTalkSession() {
  parkedLatch = null
  try {
    sessionStorage.setItem(PARK_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearParkedTalkSession() {
  parkedLatch = null
  try {
    sessionStorage.removeItem(PARK_KEY)
  } catch {
    // ignore
  }
}

/** True once if a live session was parked; clears the flag. */
export function consumeParkedTalkSession() {
  if (parkedLatch !== null) return parkedLatch
  try {
    parkedLatch = sessionStorage.getItem(PARK_KEY) === '1'
    if (parkedLatch) sessionStorage.removeItem(PARK_KEY)
  } catch {
    parkedLatch = false
  }
  return parkedLatch
}

export function isTalkParked() {
  try {
    return sessionStorage.getItem(PARK_KEY) === '1'
  } catch {
    return false
  }
}
