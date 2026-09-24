import { requireWtAdmin } from './website-tracker/adminAuth.ts'
import { getDashboardMetrics } from './website-tracker/dashboard.ts'

type NetlifyEvent = {
  httpMethod: string
  path?: string
  rawUrl?: string
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

export async function handleKeaWebsiteTrackerAdmin(event: NetlifyEvent) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' })
  }

  const auth = await requireWtAdmin(header(event, 'authorization'))
  if (!auth.ok) return json(auth.status, { error: auth.error })

  const resource = (event.queryStringParameters?.resource || 'overview').toLowerCase()

  try {
    if (resource === 'overview') {
      const data = await getDashboardMetrics()
      return json(200, data)
    }
    return json(404, { error: `Unknown resource: ${resource}` })
  } catch (e) {
    console.error('[kea-website-tracker] admin', e)
    return json(500, {
      error: e instanceof Error ? e.message : 'Failed',
    })
  }
}
