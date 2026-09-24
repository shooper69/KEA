/**
 * Kea funnel pages for Website Tracker dashboard.
 * Admins can override via wt_settings key `funnel_pages`.
 */

export type WtFunnelPageDef = {
  pageNo: number
  id: string
  shortCode: string
  displayName: string
  route: string
  matchRoutes?: string[]
}

export const DEFAULT_FUNNEL_PAGES: readonly WtFunnelPageDef[] = [
  {
    pageNo: 1,
    id: 'welcome',
    shortCode: 'WELCOME',
    displayName: 'Welcome / sign in',
    route: '/',
  },
  {
    pageNo: 2,
    id: 'home',
    shortCode: 'HOME',
    displayName: 'Home',
    route: '/home',
  },
  {
    pageNo: 3,
    id: 'conversation',
    shortCode: 'TALK',
    displayName: 'Talk',
    route: '/conversation',
  },
  {
    pageNo: 4,
    id: 'about',
    shortCode: 'ABOUT',
    displayName: 'About Kea',
    route: '/about',
  },
  {
    pageNo: 5,
    id: 'learn',
    shortCode: 'LEARN',
    displayName: 'Learn',
    route: '/learn',
  },
  {
    pageNo: 6,
    id: 'topics',
    shortCode: 'TOPICS',
    displayName: 'Topics',
    route: '/topics',
  },
  {
    pageNo: 7,
    id: 'settings',
    shortCode: 'SETTINGS',
    displayName: 'Settings',
    route: '/settings',
  },
]

/** Journey completion = reached Talk (or later) or a conversion. */
export const WT_FUNNEL_COMPLETION_PAGE_NO = 3

export function normaliseFunnelPages(value: unknown): WtFunnelPageDef[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_FUNNEL_PAGES.map((p) => ({ ...p }))
  }
  const out: WtFunnelPageDef[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const pageNo = Number(r.pageNo)
    const id = String(r.id || '').trim()
    const shortCode = String(r.shortCode || '').trim()
    const displayName = String(r.displayName || '').trim()
    const route = String(r.route || '').trim()
    if (!Number.isFinite(pageNo) || !id || !shortCode || !displayName || !route) continue
    const matchRoutes = Array.isArray(r.matchRoutes)
      ? r.matchRoutes.map((x) => String(x)).filter(Boolean)
      : undefined
    out.push({ pageNo, id, shortCode, displayName, route, matchRoutes })
  }
  return out.length
    ? out.sort((a, b) => a.pageNo - b.pageNo)
    : DEFAULT_FUNNEL_PAGES.map((p) => ({ ...p }))
}
