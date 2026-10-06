import { requireWtAdmin } from './website-tracker/adminAuth.ts'
import { buildCostsReport } from './aiUsage/buildCostsReport.ts'
import {
  normalizeRateCard,
  saveOpenAiRateCard,
} from './aiUsage/loadRateCard.ts'

type NetlifyEvent = {
  httpMethod: string
  path?: string
  rawUrl?: string
  body?: string | null
  headers?: Record<string, string | undefined>
  queryStringParameters?: Record<string, string | undefined>
}

function header(event: NetlifyEvent, name: string): string | null {
  const h = event.headers || {}
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lower && v) return v
  }
  return null
}

function json(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function parseBody(raw: string | null | undefined) {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function handleKeaCostsAdmin(event: NetlifyEvent) {
  const method = event.httpMethod.toUpperCase()
  if (method !== 'GET' && method !== 'PUT') {
    return json(405, { error: 'Method not allowed' })
  }

  const auth = await requireWtAdmin(header(event, 'authorization'))
  if (!auth.ok) return json(auth.status, { error: auth.error })

  if (method === 'PUT') {
    const body = parseBody(event.body)
    if (!body) return json(400, { error: 'Invalid JSON body' })
    try {
      const rates = normalizeRateCard({
        whisperPerMinute: Number(body.whisperPerMinute),
        chatInputPerMillion: Number(body.chatInputPerMillion),
        chatOutputPerMillion: Number(body.chatOutputPerMillion),
        ttsInputPerMillion: Number(body.ttsInputPerMillion),
        ttsAudioPerMillion: Number(body.ttsAudioPerMillion),
        ttsHdPerMillionChars: Number(body.ttsHdPerMillionChars),
      })
      const saved = await saveOpenAiRateCard(rates, auth.email || null)
      return json(200, { rates: saved })
    } catch (e) {
      console.error('[kea-costs] rate card', e)
      return json(500, {
        error: e instanceof Error ? e.message : 'Failed to save rate card',
      })
    }
  }

  const daysRaw = Number(event.queryStringParameters?.days || '30')
  const days = Number.isFinite(daysRaw) ? daysRaw : 30

  try {
    const data = await buildCostsReport(days)
    return json(200, data)
  } catch (e) {
    console.error('[kea-costs] admin', e)
    return json(500, {
      error: e instanceof Error ? e.message : 'Failed to load costs',
    })
  }
}
