import { handleKeaAccountDelete } from '../../src/server/handleKeaAccountDelete'

type AccountEvent = {
  httpMethod: string
  path?: string
  rawUrl?: string
  headers?: Record<string, string | undefined>
  body: string | null
  isBase64Encoded?: boolean
}

function normalizeHeaders(headers: AccountEvent['headers']) {
  const out: Record<string, string | string[] | undefined> = {}
  if (!headers) return out
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value
  }
  return out
}

export async function handler(event: AccountEvent) {
  const path = event.path ?? event.rawUrl ?? '/api/account/delete'
  const url = new URL('http://kea.local' + (path.startsWith('http') ? '/' : path))
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8')
  let emittedData = false
  const req = {
    method: event.httpMethod,
    url: `${url.pathname}${url.search}`,
    headers: normalizeHeaders(event.headers),
    on(name: string, fn: (...args: unknown[]) => void) {
      if (name === 'data') {
        emittedData = true
        fn(rawBody)
      }
      if (name === 'end') {
        if (!emittedData) fn(rawBody)
        else fn()
      }
      return req
    },
  }
  let status = 200
  let body = ''
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers[name] = value
    },
    end(chunk?: string) {
      status = res.statusCode
      body = chunk ?? ''
    },
  }
  await handleKeaAccountDelete(req as never, res as never, {
    SUPABASE_URL:
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  })
  return { statusCode: status, headers, body }
}
