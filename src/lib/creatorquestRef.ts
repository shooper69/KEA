const COOKIE = 'cq_ref'

export function captureCreatorQuestRefFromLocation() {
  if (typeof window === 'undefined') return
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim().toLowerCase()
  if (!ref || !/^[a-z0-9]{10,16}$/.test(ref)) return
  document.cookie = `${COOKIE}=${encodeURIComponent(ref)}; path=/; max-age=${90 * 86400}; samesite=lax`
}

export function readCreatorQuestRefFromDocument(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)cq_ref=([^;]+)/)
  if (!match) return null
  const ref = decodeURIComponent(match[1]).trim().toLowerCase()
  return /^[a-z0-9]{10,16}$/.test(ref) ? ref : null
}
