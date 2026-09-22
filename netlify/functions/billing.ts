import { handleKeaBilling } from '../../src/server/handleKeaBilling'

type BillingEvent = {
  httpMethod: string
  path?: string
  rawUrl?: string
  queryStringParameters?: Record<string, string | undefined>
  body: string | null
  isBase64Encoded?: boolean
}

export async function handler(event: BillingEvent) {
  const path = event.path ?? event.rawUrl ?? '/api/billing'
  const url = new URL('http://kea.local' + (path.startsWith('http') ? '/' : path))
  if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value) url.searchParams.set(key, value)
    }
  }
  const req = {
    method: event.httpMethod,
    url: `${url.pathname}${url.search}`,
    on(name: string, fn: (...args: unknown[]) => void) {
      if (name === 'data') {
        const raw = event.isBase64Encoded
          ? Buffer.from(event.body ?? '', 'base64')
          : Buffer.from(event.body ?? '', 'utf8')
        fn(raw)
      }
      if (name === 'end') fn()
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
  await handleKeaBilling(
    req as never,
    res as never,
    {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    },
  )
  return { statusCode: status, headers, body }
}
