import { cleanSpokenText } from '../../src/architecture/whisperText'

const LEARNER_PROMPT = 'Casual mixed English and Spanish, accents okay.'

type TranscribeEvent = {
  httpMethod: string
  body: string | null
  isBase64Encoded?: boolean
}

type WhisperVerbose = {
  text?: string
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

  let payload: { audio?: string; mimeType?: string }
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

  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType })
  const form = new FormData()
  form.append('file', blob, `speech.${extension}`)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  form.append('prompt', LEARNER_PROMPT)

  const openaiResponse = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
  )

  const data = (await openaiResponse.json()) as WhisperVerbose
  if (!openaiResponse.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: data.error?.message ?? 'Whisper transcription failed',
      }),
    }
  }

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
