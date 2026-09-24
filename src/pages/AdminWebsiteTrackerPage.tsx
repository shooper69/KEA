import { useCallback, useEffect, useState } from 'react'
import {
  WebsiteTrackerDashboard,
  type WebsiteTrackerDashboardData,
} from '../components/admin/WebsiteTrackerDashboard'
import { getSupabase } from '../lib/supabase'

export function AdminWebsiteTrackerPage() {
  const [data, setData] = useState<WebsiteTrackerDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      const {
        data: { session },
      } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
      if (!session?.access_token) {
        setError('Sign in as admin to load the tracker.')
        setData(null)
        return
      }
      const res = await fetch('/api/website-tracker/admin?resource=overview', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const raw = await res.text()
      let json: WebsiteTrackerDashboardData & { error?: string }
      try {
        json = JSON.parse(raw) as WebsiteTrackerDashboardData & {
          error?: string
        }
      } catch {
        setError(
          res.status === 404 || raw.trimStart().startsWith('<!')
            ? 'Tracker API is not reachable (got HTML instead of JSON). On localhost restart Vite; on kea.chat set SUPABASE_SERVICE_ROLE_KEY and redeploy.'
            : `Invalid tracker response (${res.status}).`,
        )
        setData(null)
        return
      }
      if (!res.ok) {
        setError(json.error || `Failed (${res.status})`)
        setData(null)
        return
      }
      setData(json)
      setRefreshedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="settings-card">
      <div className="wt-admin-head">
        <div>
          <h2>Website Tracker</h2>
          <p className="settings-note">
            First-party funnel analytics for kea.chat. Same model as Remelife
            tracker, Kea-owned data only.
          </p>
        </div>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {refreshedAt ? (
        <p className="settings-note">
          Updated {refreshedAt.toLocaleString()}
        </p>
      ) : null}
      {error ? <p className="settings-note wt-error">{error}</p> : null}
      {data ? <WebsiteTrackerDashboard data={data} /> : null}
      {!data && !error && loading ? (
        <p className="settings-note">Loading dashboard…</p>
      ) : null}
    </section>
  )
}
