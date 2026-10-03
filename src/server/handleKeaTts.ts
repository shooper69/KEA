import type { IncomingMessage, ServerResponse } from 'node:http'
import { isPublicTtsAllowed } from './keaPublicSpendGate.ts'
import {
  allowAuthenticatedTts,
  allowPublicSpend,
  clientIpFromHeaders,
  MAX_AUTH_TTS_CHARS,
} from './keaPublicRateLimit.ts'
import { requireKeaUser } from './keaUserAuth.ts'
import {
  requireKeaTalkAccess,
  talkAccessEnvFromProcess,
} from './keaTalkAccessGate.ts'

const OPENAI_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
])

/** Shared gpt-4o-mini-tts delivery — keep local + Netlify in sync. */
export const KEA_TTS_STYLE =
  'Speak softly and charmingly, like a warm close friend leaning in. Gentle, intimate, and lightly playful — never sharp, clipped, stern, or instructor-like. Soft smile in the voice, easy unhurried pacing, cozy and a little alluring. Keep intensity low and inviting.'

/** Slightly quicker delivery so replies feel snappy while staying soft. */
export const KEA_TTS_SPEED = 1.05

async function requestSpeech(
  apiKey: string,
  voice: string,
  text: string,
  extraInstructions?: string,
) {
  const hint = extraInstructions?.trim()
  const instructions = hint
    ? `${KEA_TTS_STYLE} ${hint}`
    : KEA_TTS_STYLE
  const first = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      instructions,
      speed: KEA_TTS_SPEED,
    }),
  })
  if (first.ok) return first
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice,
      input: text,
      speed: KEA_TTS_SPEED,
    }),
  })
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function reqHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

export async function handleKeaTts(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string | undefined,
) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (!apiKey) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error:
          'OPENAI_API_KEY is not set. Add it to a local .env file or Netlify environment variables.',
      }),
    )
    return
  }

  let payload: { voice?: string; text?: string; instructions?: string }
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8')) as typeof payload
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const voice = payload.voice?.trim().toLowerCase() ?? ''
  const text = payload.text?.trim() ?? ''
  if (!OPENAI_VOICES.has(voice) || !text) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Need an OpenAI voice and some text.' }))
    return
  }

  const headers = reqHeaders(req)
  const ip = clientIpFromHeaders(headers)
  if (isPublicTtsAllowed(text)) {
    if (!allowPublicSpend(`tts-public:${ip}`, 20)) {
      res.statusCode = 429
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Too many requests. Try again shortly.' }))
      return
    }
  } else {
    if (text.length > MAX_AUTH_TTS_CHARS) {
      res.statusCode = 413
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'That line is too long to speak.' }))
      return
    }
    const auth = await requireKeaUser(headers)
    if (!auth.ok) {
      res.statusCode = auth.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: auth.error }))
      return
    }
    const access = await requireKeaTalkAccess(talkAccessEnvFromProcess(), auth)
    if (!access.ok) {
      res.statusCode = access.status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: access.error }))
      return
    }
    if (!allowAuthenticatedTts(auth.userId, ip)) {
      res.statusCode = 429
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Too many requests. Try again shortly.' }))
      return
    }
  }

  const openaiResponse = await requestSpeech(
    apiKey,
    voice,
    text,
    payload.instructions,
  )

  if (!openaiResponse.ok) {
    const data = (await openaiResponse.json()) as { error?: { message?: string } }
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: data.error?.message ?? 'OpenAI speech failed',
      }),
    )
    return
  }

  const bytes = Buffer.from(await openaiResponse.arrayBuffer())
  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'no-store')
  res.end(bytes)
}
