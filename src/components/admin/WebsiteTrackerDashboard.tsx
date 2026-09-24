import type { ReactNode } from 'react'

type MatrixCell =
  | 'reached'
  | 'current'
  | 'converted'
  | 'registered'
  | 'subscriber'
  | 'dropped'
  | 'not_reached'

export type WebsiteTrackerDashboardData = {
  kpis: {
    visitorsToday: number
    visitorsWeek: number
    visitorsMonth: number
    sessions: number
    completionRate: number
    avgSessionDurationMs: number
    leadsGenerated: number
    registrationsGenerated: number
    largestDropOff: {
      from: string
      to: string
      lost: number
      pct: number
    } | null
    mostImprovedPage: {
      shortCode: string
      progressionDeltaPct: number
      visitorsDelta: number
    } | null
  }
  pages: { pageNo: number; shortCode: string; displayName: string; route: string }[]
  journeySummary: {
    pageNo: number
    shortCode: string
    displayName: string
    visitors: number
    progressPct: number
    dropOffPct: number
    avgTimeMs: number
  }[]
  dropOffTop: {
    from: string
    to: string
    lost: number
    pct: number
  }[]
  bestPerforming: {
    highestRetention: { pageNo: number; shortCode: string; retentionPct: number } | null
    mostEngaging: { pageNo: number; shortCode: string; avgTimeMs: number } | null
    highestConversionInfluence: { pageNo: number; shortCode: string; count: number } | null
    bestLanding: { pageNo: number; shortCode: string; visitors: number } | null
    longestAverageTime: { pageNo: number; shortCode: string; avgTimeMs: number } | null
  }
  journeyMatrix: {
    sessionId: string
    name: string
    landedAt: string | null
    reachedCount: number
    totalPages: number
    cells: MatrixCell[]
    registeredClick?: boolean
  }[]
  recentVisitors: {
    sessionId: string
    visitor: string
    source: string
    landingPage: string
    lastPage: string
    status: string
    visited: string | null
  }[]
  leads: {
    newToday: number
    total: number
    conversionPct: number
    topSource: { label: string; rate: number } | null
    recent: { first_name?: string | null; email?: string | null; lead_score?: number | null }[]
  }
  insights: string[]
}

function formatDuration(ms: number) {
  if (!ms || ms < 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const CELL_LABEL: Record<MatrixCell, string> = {
  reached: 'Reached',
  current: 'Current',
  converted: 'Converted',
  registered: 'Registered',
  subscriber: 'Subscriber',
  dropped: 'Dropped',
  not_reached: 'Not reached',
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="wt-kpi">
      <p className="wt-kpi__label">{label}</p>
      <p className="wt-kpi__value">{value}</p>
    </div>
  )
}

export function WebsiteTrackerDashboard({ data }: { data: WebsiteTrackerDashboardData }) {
  const { kpis } = data

  return (
    <div className="wt-dashboard">
      <div className="wt-kpi-row">
        <Kpi label="Visitors today" value={kpis.visitorsToday} />
        <Kpi label="This week" value={kpis.visitorsWeek} />
        <Kpi label="This month" value={kpis.visitorsMonth} />
        <Kpi label="Sessions" value={kpis.sessions} />
        <Kpi label="Completion" value={`${kpis.completionRate}%`} />
        <Kpi label="Avg session" value={formatDuration(kpis.avgSessionDurationMs)} />
        <Kpi label="Leads" value={kpis.leadsGenerated} />
        <Kpi label="Registrations" value={kpis.registrationsGenerated} />
        <Kpi
          label="Largest drop-off"
          value={
            kpis.largestDropOff
              ? `${kpis.largestDropOff.from} → ${kpis.largestDropOff.to}`
              : '—'
          }
        />
      </div>

      <section className="settings-card wt-panel">
        <h2>Visitor journeys</h2>
        <p className="settings-note">
          Last {data.journeyMatrix.length} sessions · cells show funnel progress
        </p>
        <div className="wt-legend">
          {(Object.keys(CELL_LABEL) as MatrixCell[]).map((k) => (
            <span key={k} className={`wt-legend__item wt-cell--${k}`}>
              {CELL_LABEL[k]}
            </span>
          ))}
        </div>
        <div className="wt-matrix-scroll">
          <table className="wt-matrix">
            <thead>
              <tr>
                <th>Visitor</th>
                {data.pages.map((p) => (
                  <th key={p.pageNo} title={p.displayName}>
                    <span className="wt-matrix__no">{p.pageNo}</span>
                    <span className="wt-matrix__code">{p.shortCode}</span>
                  </th>
                ))}
                <th>REG</th>
                <th>Steps</th>
              </tr>
            </thead>
            <tbody>
              {data.journeyMatrix.length === 0 ? (
                <tr>
                  <td colSpan={data.pages.length + 3} className="wt-empty">
                    No sessions yet. Visit kea.chat pages to start collecting.
                  </td>
                </tr>
              ) : (
                data.journeyMatrix.map((row) => (
                  <tr key={row.sessionId}>
                    <td className="wt-matrix__name">{row.name}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i}>
                        <span
                          className={`wt-dot wt-cell--${cell}`}
                          title={CELL_LABEL[cell]}
                        />
                      </td>
                    ))}
                    <td>{row.registeredClick ? '●' : '—'}</td>
                    <td>
                      {row.reachedCount}/{row.totalPages}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="wt-two-col">
        <section className="settings-card wt-panel">
          <h2>Funnel summary</h2>
          <table className="wt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Page</th>
                <th>Visitors</th>
                <th>Progress</th>
                <th>Drop-off</th>
                <th>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {data.journeySummary.map((row) => (
                <tr key={row.pageNo}>
                  <td>{row.pageNo}</td>
                  <td>
                    <strong>{row.shortCode}</strong>
                    <span className="wt-muted"> {row.displayName}</span>
                  </td>
                  <td>{row.visitors}</td>
                  <td>{row.progressPct}%</td>
                  <td>{row.dropOffPct}%</td>
                  <td>{formatDuration(row.avgTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="settings-card wt-panel">
          <h2>Leads</h2>
          <dl className="voice-diag">
            <div>
              <dt>New today</dt>
              <dd>{data.leads.newToday}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{data.leads.total}</dd>
            </div>
            <div>
              <dt>Conversion</dt>
              <dd>{data.leads.conversionPct}%</dd>
            </div>
            <div>
              <dt>Top source</dt>
              <dd>
                {data.leads.topSource
                  ? `${data.leads.topSource.label} (${data.leads.topSource.rate}%)`
                  : '—'}
              </dd>
            </div>
          </dl>
          {data.leads.recent.length ? (
            <ul className="wt-lead-list">
              {data.leads.recent.map((lead, i) => (
                <li key={i}>
                  {lead.first_name || '—'} · {lead.email || 'no email'} · score{' '}
                  {lead.lead_score ?? 0}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="settings-card wt-panel">
        <h2>Recent visitors</h2>
        <div className="wt-matrix-scroll">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Source</th>
                <th>Landing</th>
                <th>Last</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentVisitors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="wt-empty">
                    No visitors yet.
                  </td>
                </tr>
              ) : (
                data.recentVisitors.map((v) => (
                  <tr key={v.sessionId}>
                    <td>{v.visitor}</td>
                    <td>{v.source}</td>
                    <td>{v.landingPage}</td>
                    <td>{v.lastPage}</td>
                    <td>{v.status}</td>
                    <td>{formatWhen(v.visited)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.insights.length ? (
        <section className="settings-card wt-panel">
          <h2>Insights</h2>
          <ul className="wt-insights">
            {data.insights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
