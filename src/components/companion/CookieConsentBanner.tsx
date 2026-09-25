import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  COOKIE_CONSENT_EVENT,
  getCookieConsent,
  setCookieConsent,
} from '../../architecture/keaCookieConsent'

/** Bottom banner until the visitor accepts or rejects analytics cookies. */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function sync() {
      setVisible(getCookieConsent() === null)
    }
    sync()
    window.addEventListener(COOKIE_CONSENT_EVENT, sync)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync)
  }, [])

  if (!visible) return null

  return (
    <div
      className="cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-body"
    >
      <div className="cookie-banner__card">
        <h2 id="cookie-banner-title" className="cookie-banner__title">
          Cookies
        </h2>
        <p id="cookie-banner-body" className="cookie-banner__body">
          Kea uses necessary cookies to keep you signed in, and optional
          analytics cookies to understand how the site is used. You can change
          this later in our{' '}
          <Link to="/cookie-policy">Cookie Policy</Link>.
        </p>
        <div className="cookie-banner__actions">
          <button
            type="button"
            className="kea-button"
            onClick={() => setCookieConsent('accepted')}
          >
            Accept
          </button>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => setCookieConsent('rejected')}
          >
            Reject non-essential
          </button>
        </div>
      </div>
    </div>
  )
}
