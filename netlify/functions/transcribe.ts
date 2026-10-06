import { cleanSpokenText } from '../../src/architecture/whisperText'
import {
  allowAuthenticatedTranscribe,
  clientIpFromHeaders,
} from '../../src/server/keaPublicRateLimit'
import { requireKeaUser } from '../../src/server/keaUserAuth'
import {
  requireKeaTalkAccess,
  talkAccessEnvFromProcess,
} from '../../src/server/keaTalkAccessGate'
import {
  actorForEmail,
  logAiUsage,
  lookupPlanIdAtTime,
  openaiRequestId,
} from '../../src/server/aiUsage/logAiUsage'

const LEARNER_PROMPT = 'Casual mixed English and Spanish, accents okay.'
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

type TranscribeEvent = {
  httpMethod: string
  body: string | null
  isBase64Encoded?: boolean
  headers?: Record<string, string | undefined>
}

type WhisperVerbose = {
  text?: string
  duration?: number
  no_speech_prob?: number
  segments?: Array<{ avg_logprob?: number; no_speech_prob?: number }>
  error?: { message?: string }
}

function confidenceFromVerbose(data: WhisperVerbose): number {
  const segments = data.segments ?? []
  if (segments.length) {
    const avg =
      segments.reduce((sum, item) => sum + (item.avg_logprob ?? -1), 0) /
      segments.length
    return Math.min(1, Math.max(0, Number(Math.exp(avg).toFixed(3))))
  }
  if (typeof data.no_speech_prob === 'number') {
    return Math.min(1, Math.max(0, Number((1 - data.no_speech_prob).toFixed(3))))
  }
  return data.text?.trim() ? 0.5 : 0
}

export async function handler(event: TranscribeEvent) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
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
  const ip = clientIpFromHeaders(event.headers)
  if (!allowAuthenticatedTranscribe(auth.userId, ip)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Too many requests. Try again shortly.' }),
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          'OPENAI_API_KEY is not set. Add it in Netlify environment variables.',
      }),
    }
  }

  let payload: { audio?: string; mimeType?: string; prompt?: string }
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '{}')
    payload = JSON.parse(raw) as typeof payload
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const audio = payload.audio?.trim()
  if (!audio) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No audio to transcribe' }) }
  }

  const mimeType = payload.mimeType?.trim() || 'audio/webm'
  const extension = mimeType.includes('mp4')
    ? 'mp4'
    : mimeType.includes('mpeg') || mimeType.includes('mp3')
      ? 'mp3'
      : mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('ogg')
          ? 'ogg'
          : 'webm'
  const bytes = Buffer.from(audio, 'base64')
  if (bytes.length < 200) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Recording was too short' }) }
  }
  if (bytes.length > MAX_AUDIO_BYTES) {
    return {
      statusCode: 413,
      body: JSON.stringify({ error: 'Recording is too large' }),
    }
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType })
  const form = new FormData()
  form.append('file', blob, `speech.${extension}`)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  const prompt =
    typeof payload.prompt === 'string' && payload.prompt.trim()
      ? payload.prompt.trim().slice(0, 800)
      : LEARNER_PROMPT
  form.append('prompt', prompt)

  const openaiResponse = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
  )

  const data = (await openaiResponse.json()) as WhisperVerbose
  const audioSeconds =
    typeof data.duration === 'number' && data.duration > 0
      ? data.duration
      : bytes.length / 2000
  const usageBase = {
    userId: auth.userId,
    userEmail: auth.email,
    actor: actorForEmail(auth.userId, auth.email),
    feature: 'transcription' as const,
    requestType: 'audio_transcriptions' as const,
    model: 'whisper-1',
    planIdAtTime: await lookupPlanIdAtTime(auth.userId),
    audioSeconds,
    requestId: openaiRequestId(openaiResponse),
  }
  if (!openaiResponse.ok) {
    logAiUsage({ ...usageBase, status: 'error' })
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: data.error?.message ?? 'Whisper transcription failed',
      }),
    }
  }

  logAiUsage({ ...usageBase, status: 'ok' })

  const text = cleanSpokenText(data.text ?? '')

  return {
    statusCode: 200,
    body: JSON.stringify({
      text,
      confidence: confidenceFromVerbose(data),
      model: 'whisper-1',
    }),
  }
}
