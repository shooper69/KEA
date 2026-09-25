import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { COOKIE_CONSENT_EVENT } from '../../architecture/keaCookieConsent'
import {
  startTracker,
  trackPathChange,
} from '../../architecture/websiteTracker/client'

/** Mounts first-party Website Tracker for Kea routes (only after cookie Accept). */
export function WebsiteTrackerProvider() {
  const location = useLocation()

  useEffect(() => {
    startTracker()
    function onConsent() {
      startTracker()
      trackPathChange(window.location.pathname || '/')
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
  }, [])

  useEffect(() => {
    trackPathChange(location.pathname || '/')
  }, [location.pathname])

  return null
}
