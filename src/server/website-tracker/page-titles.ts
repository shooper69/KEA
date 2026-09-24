import { DEFAULT_FUNNEL_PAGES, type WtFunnelPageDef } from './funnel-pages.ts'

/** Normalise path for matching (pathname only, trailing slash trimmed except root). */
export function normaliseWtPathKey(path: string | null | undefined): string {
  if (!path) return '/'
  let p = path.trim()
  const q = p.indexOf('?')
  if (q >= 0) p = p.slice(0, q)
  const h = p.indexOf('#')
  if (h >= 0) p = p.slice(0, h)
  if (!p.startsWith('/')) p = `/${p}`
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p || '/'
}

export function resolveWtExitPage(
  path: string | null | undefined,
  pages: readonly WtFunnelPageDef[] = DEFAULT_FUNNEL_PAGES,
): WtFunnelPageDef | null {
  if (!path) return null
  const key = normaliseWtPathKey(path)
  for (const p of pages) {
    if (normaliseWtPathKey(p.route) === key) return p
    for (const m of p.matchRoutes || []) {
      if (normaliseWtPathKey(m) === key) return p
    }
  }
  return null
}

export function wtPageTitle(
  path: string | null | undefined,
  pages: readonly WtFunnelPageDef[] = DEFAULT_FUNNEL_PAGES,
): string {
  return resolveWtExitPage(path, pages)?.displayName || path || '—'
}
