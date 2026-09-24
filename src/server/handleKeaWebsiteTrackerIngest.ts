import { processWebsiteTrackerIngest } from './website-tracker/ingest.ts'
import { checkWebsiteTrackerRateLimit } from './website-tracker/rate-limit.ts'
import {
  countryFromHeaders,
  deviceClassFromUa,
  getAllowedOrigins,
  isAllowedOrigin,
  validateIngestBody,
} from './website-tracker/validate.ts'

type NetlifyEvent = {
  httpMethod: string
  headers?: Record<string, string | undefined>
  body?: string | null
  isBase64Encoded?: boolean
}

function header(event: NetlifyEvent, name: string): string | null {
  const h = event.headers || {}
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lower && v) return v
  }
  return null
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && isAllowedOrigin(origin) ? origin : getAllowedOrigins()[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export async function handleKeaWebsiteTrackerIngest(event: NetlifyEvent) {
  const origin = header(event, 'origin')
  const headers = corsHeaders(origin)

  if (event.httpMethod === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) {
      return { statusCode: 403, headers, body: '' }
    }
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  if (!isAllowedOrigin(origin)) {
    return {
      statusCode: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Origin not allowed' }),
    }
  }

  let raw: unknown
  try {
    const text = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '')
    raw = JSON.parse(text)
  } catch {
    return {
      statusCode: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    }
  }

  const validated = validateIngestBody(raw)
  if (!validated.ok) {
    return {
      statusCode: validated.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: validated.error }),
    }
  }

  const ip =
    header(event, 'x-nf-client-connection-ip') ||
    header(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  const rate = checkWebsiteTrackerRateLimit(ip, validated.body.events.length)
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Retry-After': String(rate.retryAfterSec ?? 60),
      },
      body: JSON.stringify({ error: 'Rate limited' }),
    }
  }

  try {
    const result = await processWebsiteTrackerIngest({
      body: validated.body,
      device: deviceClassFromUa(header(event, 'user-agent')),
      country: countryFromHeaders({
        get: (name: string) => header(event, name),
      }),
    })
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (e) {
    console.error('[kea-website-tracker] ingest', e)
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : 'Ingest failed',
      }),
    }
  }
}
