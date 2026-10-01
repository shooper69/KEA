import { isPublicTtsAllowed } from '../../src/server/keaPublicSpendGate'
import {
  allowAuthenticatedTts,
  allowPublicSpend,
  clientIpFromHeaders,
  MAX_AUTH_TTS_CHARS,
} from '../../src/server/keaPublicRateLimit'
import { requireKeaUser } from '../../src/server/keaUserAuth'
import {
  requireKeaTalkAccess,
  talkAccessEnvFromProcess,
} from '../../src/server/keaTalkAccessGate'

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

/** Keep in sync with src/server/handleKeaTts.ts */
const KEA_TTS_STYLE =
  'Speak softly and charmingly, like a warm close friend leaning in. Gentle, intimate, and lightly playful — never sharp, clipped, stern, or instructor-like. Soft smile in the voice, easy unhurried pacing, cozy and a little alluring. Keep intensity low and inviting.'

const KEA_TTS_SPEED = 0.92

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

type TtsEvent = {
  httpMethod: string
  body: string | null
  isBase64Encoded?: boolean
  headers?: Record<string, string | undefined>
}

export async function handler(event: TtsEvent) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'OPENAI_API_KEY is not set. Add it in Netlify environment variables.',
      }),
    }
  }

  let payload: { voice?: string; text?: string; instructions?: string }
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '{}')
    payload = JSON.parse(raw) as typeof payload
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const voice = payload.voice?.trim().toLowerCase() ?? ''
  const text = payload.text?.trim() ?? ''
  if (!OPENAI_VOICES.has(voice) || !text) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Need an OpenAI voice and some text.' }),
    }
  }

  const ip = clientIpFromHeaders(event.headers)
  if (isPublicTtsAllowed(text)) {
    if (!allowPublicSpend(`tts-public:${ip}`, 20)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many requests. Try again shortly.' }),
      }
    }
  } else {
    if (text.length > MAX_AUTH_TTS_CHARS) {
      return {
        statusCode: 413,
        body: JSON.stringify({ error: 'That line is too long to speak.' }),
      }
    }
    const auth = await requireKeaUser(event.headers)
    if (!auth.ok) {
      return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) }
    }
    const access = await requireKeaTalkAccess(talkAccessEnvFromProcess(), auth)
    if (!access.ok) {
      return {
        statusCode: access.status,
        body: JSON.stringify({ error: access.error }),
      }
    }
    if (!allowAuthenticatedTts(auth.userId, ip)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many requests. Try again shortly.' }),
      }
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
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: data.error?.message ?? 'OpenAI speech failed',
      }),
    }
  }

  const bytes = Buffer.from(await openaiResponse.arrayBuffer())
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    body: bytes.toString('base64'),
    isBase64Encoded: true,
  }
}
