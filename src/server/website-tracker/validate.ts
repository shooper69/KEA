import {
  WT_EVENT_TYPES,
  type WtIngestBody,
  type WtIngestEvent,
  type WtEventType,
} from './types.ts'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_EVENTS = 20
const MAX_PATH = 500
const MAX_NAME = 80
const MAX_PROP_KEYS = 20
const MAX_PROP_STRING = 500

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.WEBSITE_TRACKER_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const defaults = [
    'https://kea.chat',
    'https://www.kea.chat',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]

  return Array.from(new Set([...defaults, ...fromEnv]))
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return getAllowedOrigins().includes(origin)
}

function sanitizePath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let path = raw.trim()
  if (!path) return undefined
  const q = path.indexOf('?')
  if (q >= 0) path = path.slice(0, q)
  const h = path.indexOf('#')
  if (h >= 0) path = path.slice(0, h)
  if (path.length > MAX_PATH) path = path.slice(0, MAX_PATH)
  return path || undefined
}

function sanitizeProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, unknown> = {}
  let n = 0
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_PROP_KEYS) break
    if (typeof k !== 'string' || k.length > 64) continue
    if (typeof v === 'string') {
      out[k] = v.slice(0, MAX_PROP_STRING)
      n++
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v
      n++
    } else if (typeof v === 'boolean') {
      out[k] = v
      n++
    } else if (v === null) {
      out[k] = null
      n++
    }
  }
  return out
}

export function sanitizeIdentify(props: Record<string, unknown>): {
  first_name?: string
  email?: string
} {
  let first_name: string | undefined
  let email: string | undefined

  if (typeof props.first_name === 'string') {
    const name = props.first_name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME)
    if (name) first_name = name
  }

  if (typeof props.email === 'string') {
    const e = props.email.trim().toLowerCase().slice(0, 254)
    if (EMAIL_RE.test(e)) email = e
  }

  return { first_name, email }
}

function validateEvent(raw: unknown): WtIngestEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (typeof e.type !== 'string' || !WT_EVENT_TYPES.includes(e.type as WtEventType)) {
    return null
  }

  const event: WtIngestEvent = {
    type: e.type as WtEventType,
    path: sanitizePath(e.path),
    props: sanitizeProps(e.props),
  }

  if (typeof e.ts === 'string' && !Number.isNaN(Date.parse(e.ts))) {
    event.ts = new Date(e.ts).toISOString()
  }

  if (typeof e.duration_ms === 'number' && Number.isFinite(e.duration_ms)) {
    event.duration_ms = Math.max(0, Math.min(Math.floor(e.duration_ms), 86_400_000))
  }

  if (typeof e.scroll_pct === 'number' && Number.isFinite(e.scroll_pct)) {
    event.scroll_pct = Math.max(0, Math.min(Math.round(e.scroll_pct), 100))
  }

  if (event.type === 'identify') {
    const id = sanitizeIdentify(event.props || {})
    event.props = { ...event.props, ...id }
  }

  return event
}

export type ValidateResult =
  | { ok: true; body: WtIngestBody }
  | { ok: false; error: string; status: number }

export function validateIngestBody(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid JSON body', status: 400 }
  }

  const body = raw as Record<string, unknown>

  if (!isUuid(body.anon_id)) {
    return { ok: false, error: 'anon_id must be a UUID', status: 400 }
  }
  if (!isUuid(body.session_id)) {
    return { ok: false, error: 'session_id must be a UUID', status: 400 }
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return { ok: false, error: 'events must be a non-empty array', status: 400 }
  }
  if (body.events.length > MAX_EVENTS) {
    return { ok: false, error: `Max ${MAX_EVENTS} events per batch`, status: 400 }
  }

  const consentRaw = body.consent
  const consent =
    consentRaw && typeof consentRaw === 'object'
      ? {
          analytics: (consentRaw as { analytics?: unknown }).analytics === true,
          v:
            typeof (consentRaw as { v?: unknown }).v === 'string'
              ? String((consentRaw as { v: string }).v).slice(0, 32)
              : undefined,
        }
      : { analytics: true as boolean, v: undefined as string | undefined }

  if (!consent.analytics) {
    return { ok: false, error: 'analytics consent required', status: 403 }
  }

  const events: WtIngestEvent[] = []
  for (const item of body.events) {
    const ev = validateEvent(item)
    if (ev) events.push(ev)
  }

  if (events.length === 0) {
    return { ok: false, error: 'No valid events', status: 400 }
  }

  return {
    ok: true,
    body: {
      anon_id: body.anon_id,
      session_id: body.session_id,
      consent,
      events,
    },
  }
}

export function deviceClassFromUa(ua: string | null): string {
  if (!ua) return 'unknown'
  const s = ua.toLowerCase()
  if (/ipad|tablet|kindle|playbook|silk/.test(s)) return 'tablet'
  if (/mobi|iphone|ipod|android.+mobile|windows phone/.test(s)) return 'mobile'
  return 'desktop'
}

export function countryFromHeaders(headers: {
  get(name: string): string | null
}): string | null {
  const cf = headers.get('cf-ipcountry') || headers.get('x-country')
  if (cf && cf.length === 2 && cf !== 'XX') return cf.toUpperCase()
  return null
}
