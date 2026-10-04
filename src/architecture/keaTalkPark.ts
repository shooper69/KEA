/**
 * When the user leaves the chat page while Kea is live, park the session:
 * mic stops, but returning to chat resumes listening without a wake prompt
 * and restarts the stay-live idle window.
 */

const PARK_KEY = 'kea-talk-parked-v1'

export function parkTalkSession() {
  try {
    sessionStorage.setItem(PARK_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearParkedTalkSession() {
  try {
    sessionStorage.removeItem(PARK_KEY)
  } catch {
    // ignore
  }
}

/** True once if a live session was parked; clears the flag. */
export function consumeParkedTalkSession() {
  try {
    if (sessionStorage.getItem(PARK_KEY) !== '1') return false
    sessionStorage.removeItem(PARK_KEY)
    return true
  } catch {
    return false
  }
}

export function isTalkParked() {
  try {
    return sessionStorage.getItem(PARK_KEY) === '1'
  } catch {
    return false
  }
}
