import { defineConfig, loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { handleKeaBilling } from './src/server/handleKeaBilling.ts'
import { handleKeaChat } from './src/server/handleKeaChat.ts'
import { handleKeaTranscribe } from './src/server/handleKeaTranscribe.ts'
import { handleKeaTts } from './src/server/handleKeaTts.ts'
import { handleKeaWebsiteTrackerAdmin } from './src/server/handleKeaWebsiteTrackerAdmin.ts'
import { handleKeaWebsiteTrackerIngest } from './src/server/handleKeaWebsiteTrackerIngest.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function headerMap(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

async function runNetlifyStyle(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (event: {
    httpMethod: string
    path?: string
    headers?: Record<string, string | undefined>
    queryStringParameters?: Record<string, string | undefined>
    body?: string | null
    isBase64Encoded?: boolean
  }) => Promise<{
    statusCode: number
    headers?: Record<string, string>
    body?: string
  }>,
) {
  const url = new URL(req.url || '/', 'http://kea.local')
  const query: Record<string, string | undefined> = {}
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value
  }
  const method = (req.method || 'GET').toUpperCase()
  const body =
    method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
      ? null
      : await readBody(req)
  const result = await handler({
    httpMethod: method,
    path: url.pathname,
    headers: headerMap(req),
    queryStringParameters: query,
    body,
  })
  res.statusCode = result.statusCode
  for (const [key, value] of Object.entries(result.headers || {})) {
    res.setHeader(key, value)
  }
  if (!result.headers?.['Content-Type'] && !result.headers?.['content-type']) {
    res.setHeader('Content-Type', 'application/json')
  }
  res.end(result.body ?? '')
}

function keaApiPlugin(env: Record<string, string>): Plugin {
  const attach = (
    middlewares: {
      use: (
        fn: (
          req: IncomingMessage,
          res: ServerResponse,
          next: (err?: unknown) => void,
        ) => void,
      ) => void
    },
  ) => {
    middlewares.use((req, res, next) => {
      const url = req.url || ''
      if (url.startsWith('/api/website-tracker/admin')) {
        void runNetlifyStyle(req, res, handleKeaWebsiteTrackerAdmin).catch(
          (err) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Tracker admin failed',
              }),
            )
          },
        )
        return
      }
      if (url.startsWith('/api/website-tracker/ingest')) {
        void runNetlifyStyle(req, res, handleKeaWebsiteTrackerIngest).catch(
          (err) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : 'Tracker ingest failed',
              }),
            )
          },
        )
        return
      }
      if (url.startsWith('/api/billing')) {
        void handleKeaBilling(req, res, {
          STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
        })
        return
      }
      if (url.startsWith('/api/transcribe')) {
        void handleKeaTranscribe(req, res, env.OPENAI_API_KEY)
        return
      }
      if (url.startsWith('/api/tts')) {
        void handleKeaTts(req, res, env.OPENAI_API_KEY)
        return
      }
      if (!url.startsWith('/api/chat')) {
        next()
        return
      }
      void handleKeaChat(req, res, env.OPENAI_API_KEY)
    })
  }

  return {
    name: 'kea-chat-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    publicDir: 'assets/images',
    plugins: [react(), keaApiPlugin(env)],
  }
})
