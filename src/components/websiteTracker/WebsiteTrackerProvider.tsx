import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { startTracker, trackPathChange } from '../../architecture/websiteTracker/client'

/** Mounts first-party Website Tracker for Kea routes. */
export function WebsiteTrackerProvider() {
  const location = useLocation()

  useEffect(() => {
    startTracker()
  }, [])

  useEffect(() => {
    trackPathChange(location.pathname || '/')
  }, [location.pathname])

  return null
}
