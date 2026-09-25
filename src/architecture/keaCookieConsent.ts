/** Cookie / analytics consent for Kea (first-party tracker). */

export const COOKIE_CONSENT_KEY = 'kea_analytics_consent'
export const COOKIE_CONSENT_EVENT = 'kea-cookie-consent-changed'

export type CookieConsentChoice = 'accepted' | 'rejected'

export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (raw === '1' || raw === 'true' || raw === 'accepted') return 'accepted'
    if (raw === '0' || raw === 'false' || raw === 'rejected') return 'rejected'
    return null
  } catch {
    return null
  }
}

/** Analytics only after an explicit Accept. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'accepted'
}

export function setCookieConsent(choice: CookieConsentChoice) {
  try {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      choice === 'accepted' ? '1' : '0',
    )
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { choice } }),
    )
  }
}

export function clearCookieConsentChoice() {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY)
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { choice: null } }),
    )
  }
}
