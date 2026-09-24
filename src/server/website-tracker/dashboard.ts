import { getWtSupabase } from './supabase.ts'
import { classifyTrafficSource, SOURCE_LABELS } from './sources.ts'
import { getFunnelPages } from './settings.ts'
import { normaliseWtPathKey, resolveWtExitPage } from './page-titles.ts'
import {
  WT_FUNNEL_COMPLETION_PAGE_NO,
  type WtFunnelPageDef,
} from './funnel-pages.ts'

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

export type MatrixCellStatus =
  | 'reached'
  | 'current'
  | 'converted'
  | 'registered'
  | 'subscriber'
  | 'dropped'
  | 'not_reached'

function buildIdMaps(pages: WtFunnelPageDef[]) {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const routeToId = new Map<string, string>()
  for (const p of pages) {
    routeToId.set(normaliseWtPathKey(p.route), p.id)
    for (const m of p.matchRoutes || []) {
      routeToId.set(normaliseWtPathKey(m), p.id)
    }
  }
  return { byId, routeToId }
}

function resolvePageId(
  path: string | null | undefined,
  routeToId: Map<string, string>,
  pages: WtFunnelPageDef[],
): string | null {
  if (!path) return null
  const fromCatalog = resolveWtExitPage(path, pages)?.id
  if (fromCatalog) return fromCatalog
  return routeToId.get(normaliseWtPathKey(path)) || null
}

function pct(n: number, d: number) {
  if (!d) return 0
  return Number(((n / d) * 100).toFixed(1))
}

function formatInsightList(items: string[]) {
  return items.filter(Boolean).slice(0, 6)
}

export async function getDashboardMetrics() {
  const db = getWtSupabase()
  const pages = await getFunnelPages()
  const { byId, routeToId } = buildIdMaps(pages)
  const todayStart = startOfDay().toISOString()
  const yesterdayStart = startOfDay(new Date(Date.now() - 86400000)).toISOString()
  const week = daysAgo(7)
  const month = daysAgo(30)

  const [
    { count: visitorsToday },
    { count: visitorsWeek },
    { count: visitorsMonth },
    { count: sessionsTotal },
    { count: leadsTotal },
    { count: leadsToday },
    { count: registerClicksMonth },
    { count: registerCompleteMonth },
    { data: monthSessionsRaw },
    { data: recentSessionsRaw },
    { data: yesterdaySessionsRaw },
    { data: todaySessionsRaw },
  ] = await Promise.all([
    db.from('wt_visitors').select('*', { count: 'exact', head: true }).gte('last_seen_at', todayStart),
    db.from('wt_visitors').select('*', { count: 'exact', head: true }).gte('last_seen_at', week),
    db.from('wt_visitors').select('*', { count: 'exact', head: true }).gte('last_seen_at', month),
    db.from('wt_sessions').select('*', { count: 'exact', head: true }),
    db
      .from('wt_visitors')
      .select('*', { count: 'exact', head: true })
      .or('email.not.is.null,first_name.not.is.null'),
    db
      .from('wt_visitors')
      .select('*', { count: 'exact', head: true })
      .gte('first_seen_at', todayStart)
      .or('email.not.is.null,first_name.not.is.null'),
    db
      .from('wt_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('kind', 'register_click')
      .gte('occurred_at', month),
    db
      .from('wt_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('kind', 'register_complete')
      .gte('occurred_at', month),
    db
      .from('wt_sessions')
      .select(
        'id, visitor_id, landed_at, last_heartbeat_at, landing_path, exit_path, current_path, source, medium, referrer, wt_visitors(first_name, email, lead_score)',
      )
      .gte('landed_at', month)
      .order('landed_at', { ascending: false })
      .limit(2000),
    db
      .from('wt_sessions')
      .select(
        'id, visitor_id, landed_at, last_heartbeat_at, landing_path, exit_path, current_path, source, medium, referrer, wt_visitors(first_name, email, lead_score)',
      )
      .order('landed_at', { ascending: false })
      .limit(100),
    db
      .from('wt_sessions')
      .select('id, landing_path, exit_path')
      .gte('landed_at', yesterdayStart)
      .lt('landed_at', todayStart)
      .limit(2000),
    db
      .from('wt_sessions')
      .select('id, landing_path, exit_path')
      .gte('landed_at', todayStart)
      .limit(2000),
  ])

  type VisitorJoin = {
    first_name?: string | null
    email?: string | null
    lead_score?: number | null
  } | null
  type SessionRow = {
    id: string
    visitor_id?: string
    landed_at?: string | null
    last_heartbeat_at?: string | null
    landing_path?: string | null
    exit_path?: string | null
    current_path?: string | null
    source?: string | null
    medium?: string | null
    referrer?: string | null
    wt_visitors?: VisitorJoin | VisitorJoin[]
  }
  type PathSession = {
    id: string
    landing_path?: string | null
    exit_path?: string | null
  }

  const monthSessions = (monthSessionsRaw || []) as SessionRow[]
  const recentSessions = (recentSessionsRaw || []) as SessionRow[]
  const yesterdaySessions = (yesterdaySessionsRaw || []) as PathSession[]
  const todaySessions = (todaySessionsRaw || []) as PathSession[]

  const sessionIds = monthSessions.map((s) => s.id)
  const recentIds = recentSessions.map((s) => s.id)
  const eventSessionIds = [
    ...recentIds,
    ...sessionIds.filter((id: string) => !recentIds.includes(id)).slice(0, 400),
  ].slice(0, 500)

  const [{ data: pageViews }, { data: conversions }] = await Promise.all([
    eventSessionIds.length
      ? db
          .from('wt_events')
          .select('session_id, path, type, duration_ms, ts, props')
          .in('session_id', eventSessionIds)
          .in('type', ['page_view', 'page_leave'])
          .order('ts', { ascending: true })
          .limit(20000)
      : Promise.resolve({
          data: [] as {
            session_id: string
            path: string | null
            type: string
            duration_ms: number | null
            ts: string
            props: Record<string, unknown> | null
          }[],
        }),
    sessionIds.length
      ? db
          .from('wt_conversions')
          .select('session_id, visitor_id, kind')
          .in('session_id', sessionIds.slice(0, 500))
          .limit(10000)
      : Promise.resolve({
          data: [] as { session_id: string | null; visitor_id: string | null; kind: string }[],
        }),
  ])

  const viewsBySession = new Map<string, string[]>()
  const durationByPageId = new Map<string, { sum: number; n: number }>()
  for (const ev of pageViews || []) {
    if (ev.type === 'page_view' && ev.path) {
      const list = viewsBySession.get(ev.session_id) || []
      list.push(ev.path)
      viewsBySession.set(ev.session_id, list)
    }
    if (ev.type === 'page_leave' && ev.path && ev.duration_ms != null) {
      const id = resolvePageId(ev.path, routeToId, pages)
      if (!id) continue
      const cur = durationByPageId.get(id) || { sum: 0, n: 0 }
      cur.sum += ev.duration_ms
      cur.n++
      durationByPageId.set(id, cur)
    }
  }

  const convBySession = new Map<string, Set<string>>()
  for (const c of conversions || []) {
    if (!c.session_id) continue
    const set = convBySession.get(c.session_id) || new Set()
    set.add(c.kind)
    convBySession.set(c.session_id, set)
  }

  function pagesReached(
    sessionId: string,
    landing?: string | null,
    exit?: string | null,
    current?: string | null,
  ) {
    const paths = [...(viewsBySession.get(sessionId) || [])]
    if (landing) paths.unshift(landing)
    if (current) paths.push(current)
    if (exit) paths.push(exit)
    const ids = new Set<string>()
    for (const p of paths) {
      const id = resolvePageId(p, routeToId, pages)
      if (id) ids.add(id)
    }
    return ids
  }

  const starters = monthSessions.length
  const reachedCounts = new Map<string, number>()
  for (const p of pages) reachedCounts.set(p.id, 0)

  let completed = 0
  let durationSum = 0
  let durationN = 0
  const sourceBuckets = new Map<string, { sessions: number; conversions: number }>()

  for (const s of monthSessions) {
    const reached = pagesReached(s.id, s.landing_path, s.exit_path, s.current_path)
    for (const id of reached) {
      reachedCounts.set(id, (reachedCounts.get(id) || 0) + 1)
    }
    const maxNo = [...reached].reduce((max, id) => {
      const n = byId.get(id)?.pageNo || 0
      return Math.max(max, n)
    }, 0)
    const kinds = convBySession.get(s.id)
    const didComplete =
      maxNo >= WT_FUNNEL_COMPLETION_PAGE_NO ||
      kinds?.has('register_click') ||
      kinds?.has('register_complete')
    if (didComplete) completed++

    const start = s.landed_at ? Date.parse(s.landed_at) : NaN
    const end = s.last_heartbeat_at ? Date.parse(s.last_heartbeat_at) : NaN
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durationSum += end - start
      durationN++
    }

    const bucket = classifyTrafficSource(s)
    const row = sourceBuckets.get(bucket) || { sessions: 0, conversions: 0 }
    row.sessions++
    if (kinds?.has('register_click') || kinds?.has('register_complete')) row.conversions++
    sourceBuckets.set(bucket, row)
  }

  const journeySummary = pages.map((p, idx) => {
    const visitors = reachedCounts.get(p.id) || 0
    const progressPct = pct(visitors, starters || 1)
    const next = pages[idx + 1]
    const nextVisitors = next ? reachedCounts.get(next.id) || 0 : visitors
    const lost = next ? Math.max(0, visitors - nextVisitors) : 0
    const dropOffPct = next ? pct(lost, visitors || 1) : 0
    const dur = durationByPageId.get(p.id)
    return {
      pageNo: p.pageNo,
      id: p.id,
      shortCode: p.shortCode,
      displayName: p.displayName,
      route: p.route,
      visitors,
      progressPct,
      dropOffPct,
      avgTimeMs: dur && dur.n ? Math.round(dur.sum / dur.n) : 0,
      lostToNext: lost,
    }
  })

  const dropOffTop = journeySummary
    .slice(0, -1)
    .map((r, i) => ({
      fromPageNo: r.pageNo,
      toPageNo: journeySummary[i + 1].pageNo,
      from: r.shortCode,
      to: journeySummary[i + 1].shortCode,
      lost: r.lostToNext,
      pct: r.dropOffPct,
    }))
    .filter((d) => d.lost > 0)
    .sort((a, b) => b.pct - a.pct || b.lost - a.lost)
    .slice(0, 5)

  const largestDropOff = dropOffTop[0] || null

  const withRetention = journeySummary.slice(0, -1).map((r, i) => ({
    ...r,
    retentionPct: 100 - r.dropOffPct,
    next: journeySummary[i + 1],
  }))
  const highestRetention = [...withRetention].sort((a, b) => b.retentionPct - a.retentionPct)[0]
  const mostEngaging = [...journeySummary].sort((a, b) => b.avgTimeMs - a.avgTimeMs)[0]
  const bestLanding = [...journeySummary].sort((a, b) => b.visitors - a.visitors)[0]
  const longestTime = mostEngaging

  const convSessionIds = new Set(
    [...convBySession.entries()]
      .filter(([, kinds]) => kinds.has('register_click') || kinds.has('register_complete'))
      .map(([id]) => id),
  )
  const influence = new Map<string, number>()
  for (const s of monthSessions) {
    if (!convSessionIds.has(s.id)) continue
    for (const id of pagesReached(s.id, s.landing_path, s.exit_path)) {
      influence.set(id, (influence.get(id) || 0) + 1)
    }
  }
  const highestConversionInfluence = [...influence.entries()]
    .map(([id, count]) => ({ page: byId.get(id), count }))
    .filter((x) => x.page)
    .sort((a, b) => b.count - a.count)[0]

  function countReached(
    sessions: { id: string; landing_path?: string | null; exit_path?: string | null }[],
  ) {
    const map = new Map<string, number>()
    for (const p of pages) map.set(p.id, 0)
    for (const s of sessions) {
      for (const id of pagesReached(s.id, s.landing_path, s.exit_path)) {
        map.set(id, (map.get(id) || 0) + 1)
      }
    }
    return map
  }
  const todayReached = countReached(todaySessions)
  const ydayReached = countReached(yesterdaySessions)
  const todayN = todaySessions.length || 1
  const ydayN = yesterdaySessions.length || 1
  const biggestChanges = pages
    .map((p) => {
      const t = todayReached.get(p.id) || 0
      const y = ydayReached.get(p.id) || 0
      const tPct = pct(t, todayN)
      const yPct = pct(y, ydayN)
      return {
        pageNo: p.pageNo,
        shortCode: p.shortCode,
        visitorsDelta: t - y,
        progressionDeltaPct: Number((tPct - yPct).toFixed(1)),
      }
    })
    .sort(
      (a, b) =>
        Math.abs(b.progressionDeltaPct) - Math.abs(a.progressionDeltaPct) ||
        Math.abs(b.visitorsDelta) - Math.abs(a.visitorsDelta),
    )
    .slice(0, 6)

  const mostImproved = biggestChanges.find((c) => c.progressionDeltaPct > 0) || null

  const matrix = recentSessions.map((s) => {
    const v = Array.isArray(s.wt_visitors) ? s.wt_visitors[0] : s.wt_visitors
    const reached = pagesReached(s.id, s.landing_path, s.exit_path, s.current_path)
    const kinds = convBySession.get(s.id) || new Set()
    const lastId =
      resolvePageId(s.exit_path || s.current_path, routeToId, pages) ||
      [...reached].sort((a, b) => (byId.get(a)?.pageNo || 0) - (byId.get(b)?.pageNo || 0)).pop() ||
      null
    const maxNo = [...reached].reduce((m, id) => Math.max(m, byId.get(id)?.pageNo || 0), 0)
    const completedJourney =
      maxNo >= WT_FUNNEL_COMPLETION_PAGE_NO ||
      kinds.has('register_complete') ||
      kinds.has('register_click')

    const cells: MatrixCellStatus[] = pages.map((p) => {
      if (kinds.has('subscription_completed') || kinds.has('subscription_started')) {
        if (reached.has(p.id) && p.id === lastId) return 'subscriber'
      }
      if (kinds.has('register_complete') || kinds.has('register_click')) {
        if (reached.has(p.id) && p.id === lastId) return 'registered'
      }
      if (v?.email && reached.has(p.id) && p.id === lastId) return 'converted'
      if (!reached.has(p.id)) return 'not_reached'
      if (p.id === lastId && !completedJourney) return 'dropped'
      return 'reached'
    })

    const reachedCount = cells.filter((c) => c !== 'not_reached').length
    return {
      sessionId: s.id,
      name: v?.first_name?.trim() || 'Anonymous',
      landedAt: s.landed_at,
      reachedCount,
      totalPages: pages.length,
      cells,
      registeredClick: kinds.has('register_click') || kinds.has('register_complete'),
    }
  })

  const recentVisitors = recentSessions.slice(0, 50).map((s) => {
    const v = Array.isArray(s.wt_visitors) ? s.wt_visitors[0] : s.wt_visitors
    const landing = resolvePageId(s.landing_path, routeToId, pages)
    const last = resolvePageId(s.exit_path || s.current_path, routeToId, pages)
    const kinds = convBySession.get(s.id) || new Set()
    return {
      sessionId: s.id,
      visitor: v?.first_name?.trim() || 'Anonymous',
      source: SOURCE_LABELS[classifyTrafficSource(s)],
      landingPage: landing ? byId.get(landing)?.shortCode || landing : '—',
      lastPage: last ? byId.get(last)?.shortCode || last : '—',
      status: kinds.has('subscription_completed')
        ? 'Subscriber'
        : kinds.has('register_complete')
          ? 'Registered'
          : kinds.has('register_click')
            ? 'Converted'
            : 'Visitor',
      visited: s.landed_at,
    }
  })

  const { data: topLeads } = await db
    .from('wt_visitors')
    .select('first_name, email, lead_score, last_seen_at')
    .or('email.not.is.null,first_name.not.is.null')
    .order('last_seen_at', { ascending: false })
    .limit(8)

  const leadSources = [...sourceBuckets.entries()]
    .map(([bucket, row]) => ({
      label: SOURCE_LABELS[bucket as keyof typeof SOURCE_LABELS] || bucket,
      sessions: row.sessions,
      conversions: row.conversions,
      rate: pct(row.conversions, row.sessions || 1),
    }))
    .sort((a, b) => b.conversions - a.conversions)

  const topLeadSource = leadSources[0] || null
  const completionRate = pct(completed, starters || 1)
  const avgSessionDurationMs = durationN ? Math.round(durationSum / durationN) : 0
  const leadConversionPct = pct(leadsTotal || 0, visitorsMonth || 1)

  const insights = formatInsightList([
    largestDropOff
      ? `Most visitors drop between ${largestDropOff.from} and ${largestDropOff.to} (${largestDropOff.pct}%).`
      : '',
    highestRetention
      ? `${highestRetention.shortCode} has the highest retention (${highestRetention.retentionPct}%).`
      : '',
    leadSources.length >= 2 && leadSources[0].rate > leadSources[1].rate
      ? `${leadSources[0].label} converts better than ${leadSources[1].label}.`
      : '',
    mostImproved
      ? `${mostImproved.shortCode} improved ${mostImproved.progressionDeltaPct}% since yesterday.`
      : '',
    bestLanding
      ? `${bestLanding.shortCode} is the most reached page (${bestLanding.visitors} visitors).`
      : '',
  ])

  return {
    kpis: {
      visitorsToday: visitorsToday || 0,
      visitorsWeek: visitorsWeek || 0,
      visitorsMonth: visitorsMonth || 0,
      sessions: sessionsTotal || 0,
      completionRate,
      avgSessionDurationMs,
      leadsGenerated: leadsTotal || 0,
      registrationsGenerated: (registerCompleteMonth || 0) + (registerClicksMonth || 0),
      largestDropOff,
      mostImprovedPage: mostImproved,
    },
    pages: pages.map((p) => ({
      pageNo: p.pageNo,
      shortCode: p.shortCode,
      displayName: p.displayName,
      route: p.route,
    })),
    journeySummary,
    dropOffTop,
    bestPerforming: {
      highestRetention: highestRetention
        ? {
            pageNo: highestRetention.pageNo,
            shortCode: highestRetention.shortCode,
            retentionPct: highestRetention.retentionPct,
          }
        : null,
      mostEngaging: mostEngaging
        ? {
            pageNo: mostEngaging.pageNo,
            shortCode: mostEngaging.shortCode,
            avgTimeMs: mostEngaging.avgTimeMs,
          }
        : null,
      highestConversionInfluence: highestConversionInfluence?.page
        ? {
            pageNo: highestConversionInfluence.page.pageNo,
            shortCode: highestConversionInfluence.page.shortCode,
            count: highestConversionInfluence.count,
          }
        : null,
      bestLanding: bestLanding
        ? {
            pageNo: bestLanding.pageNo,
            shortCode: bestLanding.shortCode,
            visitors: bestLanding.visitors,
          }
        : null,
      longestAverageTime: longestTime
        ? {
            pageNo: longestTime.pageNo,
            shortCode: longestTime.shortCode,
            avgTimeMs: longestTime.avgTimeMs,
          }
        : null,
    },
    biggestChanges,
    journeyMatrix: matrix,
    recentVisitors,
    leads: {
      newToday: leadsToday || 0,
      total: leadsTotal || 0,
      conversionPct: leadConversionPct,
      topSource: topLeadSource
        ? { label: topLeadSource.label, rate: topLeadSource.rate }
        : null,
      recent: topLeads || [],
    },
    insights,
  }
}
