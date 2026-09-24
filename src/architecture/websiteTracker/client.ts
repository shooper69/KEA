/**
 * First-party Website Tracker client for Kea.
 * Sends consented events to /api/website-tracker/ingest — never talks to Supabase directly.
 */

const ANON_KEY = 'wt_anon_id'
const SESSION_KEY = 'wt_session_id'
const SESSION_STARTED_KEY = 'wt_session_started'
const CONSENT_KEY = 'kea_analytics_consent'
const LAST_PATH_KEY = 'wt_last_path'
const PAGE_ENTERED_KEY = 'wt_page_entered_ms'

let pathOverride: string | null = null

export function setTrackedPathOverride(path: string | null) {
  pathOverride = path
}

export type WtIdentifyPayload = {
  first_name?: string
  email?: string
}

type WtEventType =
  | 'session_start'
  | 'page_view'
  | 'page_leave'
  | 'click'
  | 'identify'
  | 'register_click'
  | 'contact_form_submitted'
  | 'video_complete'

type QueueItem = {
  type: WtEventType
  path?: string
  ts?: string
  duration_ms?: number
  scroll_pct?: number
  props?: Record<string, unknown>
}

function ingestUrl(): string {
  const explicit = import.meta.env.VITE_WEBSITE_TRACKER_INGEST_URL as string | undefined
  if (explicit) return explicit
  return '/api/website-tracker/ingest'
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Analytics on by default; set localStorage kea_analytics_consent=0 to opt out. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === '0' || raw === 'false') return false
    return true
  } catch {
    return true
  }
}

function getAnonId(): string {
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = uuid()
    sessionStorage.setItem(SESSION_KEY, id)
    sessionStorage.removeItem(SESSION_STARTED_KEY)
  }
  return id
}

function currentUrlPath(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname || '/'
}

function currentPath(): string {
  return pathOverride || currentUrlPath()
}

function scrollPct(): number {
  const el = document.documentElement
  const scrollTop = window.scrollY || el.scrollTop
  const height = el.scrollHeight - el.clientHeight
  if (height <= 0) return 100
  return Math.max(0, Math.min(100, Math.round((scrollTop / height) * 100)))
}

function parseUtm(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const out: Record<string, string> = {}
  const utm_source = params.get('utm_source')
  const utm_medium = params.get('utm_medium')
  const utm_campaign = params.get('utm_campaign')
  if (utm_source) out.source = utm_source
  if (utm_medium) out.medium = utm_medium
  if (utm_campaign) out.campaign = utm_campaign
  if (document.referrer) out.referrer = document.referrer
  return out
}

let queue: QueueItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let started = false
let listenersBound = false

function enqueue(item: QueueItem) {
  if (!hasAnalyticsConsent()) return
  queue.push({ ...item, ts: item.ts || new Date().toISOString() })
  if (queue.length >= 10) {
    void flush()
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      void flush()
    }, 2000)
  }
}

async function flush() {
  if (!hasAnalyticsConsent() || queue.length === 0) {
    queue = []
    return
  }
  const events = queue.splice(0, 20)
  const payload = {
    anon_id: getAnonId(),
    session_id: getSessionId(),
    consent: { analytics: true, v: '1' },
    events,
  }

  try {
    await fetch(ingestUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    })
  } catch (err) {
    if (queue.length < 40) queue.unshift(...events)
    console.warn('[kea-website-tracker] flush failed', err)
  }
}

function trackPageLeave(path: string) {
  const entered = Number(sessionStorage.getItem(PAGE_ENTERED_KEY) || '0')
  const duration_ms = entered ? Math.max(0, Date.now() - entered) : undefined
  enqueue({
    type: 'page_leave',
    path,
    duration_ms,
    scroll_pct: scrollPct(),
  })
}

function trackPageView(path: string, props?: Record<string, unknown>) {
  const last = sessionStorage.getItem(LAST_PATH_KEY)
  if (last === path) return
  if (last) trackPageLeave(last)
  sessionStorage.setItem(LAST_PATH_KEY, path)
  sessionStorage.setItem(PAGE_ENTERED_KEY, String(Date.now()))
  enqueue({
    type: 'page_view',
    path,
    props: {
      title: typeof document !== 'undefined' ? document.title : undefined,
      ...(props || {}),
    },
  })
}

function ensureSessionStart(path: string) {
  if (sessionStorage.getItem(SESSION_STARTED_KEY) === '1') return
  sessionStorage.setItem(SESSION_STARTED_KEY, '1')
  enqueue({
    type: 'session_start',
    path,
    props: parseUtm(),
  })
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    trackPageLeave(currentPath())
    void flush()
  } else if (hasAnalyticsConsent()) {
    sessionStorage.setItem(PAGE_ENTERED_KEY, String(Date.now()))
  }
}

function onClickCapture(ev: MouseEvent) {
  if (!hasAnalyticsConsent()) return
  const target = ev.target as Element | null
  if (!target) return

  const el = target.closest<HTMLElement>('[data-wt]')
  if (!el) return

  const wt = el.getAttribute('data-wt')
  const href = el instanceof HTMLAnchorElement ? el.href : el.getAttribute('href') || undefined

  if (wt === 'register') {
    enqueue({
      type: 'register_click',
      path: currentPath(),
      props: {
        target_url: href,
        element_id: el.id || undefined,
        label: (el.textContent || '').trim().slice(0, 120),
      },
    })
    void flush()
    return
  }

  if (wt) {
    enqueue({
      type: 'click',
      path: currentPath(),
      props: {
        element_id: wt,
        href,
        label: (el.textContent || '').trim().slice(0, 120),
      },
    })
  }
}

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', () => {
    trackPageLeave(currentPath())
    void flush()
  })
  document.addEventListener('click', onClickCapture, true)
  window.addEventListener('storage', (e) => {
    if (e.key === CONSENT_KEY) {
      if (hasAnalyticsConsent()) startTracker()
      else stopTracker()
    }
  })
}

export function startTracker() {
  if (typeof window === 'undefined') return
  bindListeners()
  if (!hasAnalyticsConsent()) return
  if (started) return
  started = true
  const path = currentPath()
  ensureSessionStart(path)
  trackPageView(path)
  void flush()
}

export function stopTracker() {
  started = false
  queue = []
}

export function trackPathChange(path: string, props?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return
  ensureSessionStart(path)
  trackPageView(path, props)
  void flush()
}

export function identify(payload: WtIdentifyPayload) {
  if (!hasAnalyticsConsent()) return
  const props: Record<string, unknown> = {}
  if (payload.first_name?.trim()) props.first_name = payload.first_name.trim()
  if (payload.email?.trim()) props.email = payload.email.trim().toLowerCase()
  if (!props.first_name && !props.email) return
  ensureSessionStart(currentPath())
  enqueue({
    type: 'identify',
    path: currentPath(),
    props,
  })
  void flush()
}

export function trackRegisterClick(props?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return
  enqueue({
    type: 'register_click',
    path: currentPath(),
    props: props || {},
  })
  void flush()
}
