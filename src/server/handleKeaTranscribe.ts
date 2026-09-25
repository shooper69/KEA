import type { IncomingMessage, ServerResponse } from 'node:http'
import { cleanSpokenText } from '../architecture/whisperText.ts'

const LEARNER_PROMPT = 'Casual mixed English and Spanish, accents okay.'

interface TranscribeRequest {
  audio?: string
  mimeType?: string
  prompt?: string
  language?: string
}

interface WhisperVerbose {
  text?: string
  no_speech_prob?: number
  segments?: Array<{
    avg_logprob?: number
    no_speech_prob?: number
  }>
  error?: { message?: string }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function confidenceFromVerbose(data: WhisperVerbose): number {
  const segments = data.segments ?? []
  if (segments.length) {
    const avg = segments.reduce((sum, item) => sum + (item.avg_logprob ?? -1), 0) /
      segments.length
    return Math.min(1, Math.max(0, Number(Math.exp(avg).toFixed(3))))
  }
  if (typeof data.no_speech_prob === 'number') {
    return Math.min(1, Math.max(0, Number((1 - data.no_speech_prob).toFixed(3))))
  }
  return data.text?.trim() ? 0.5 : 0
}

export async function handleKeaTranscribe(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string | undefined,
) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (!apiKey) {
    res.statusCode = 500
    res.end(
      JSON.stringify({
        error:
          'OPENAI_API_KEY is not set. Add it to a local .env file or Netlify environment variables.',
      }),
    )
    return
  }

  let payload: TranscribeRequest
  try {
    payload = JSON.parse((await readBody(req)).toString('utf8')) as TranscribeRequest
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const audio = payload.audio?.trim()
  if (!audio) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'No audio to transcribe' }))
    return
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
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Recording was too short' }))
    return
  }
  if (bytes.length > 20 * 1024 * 1024) {
    res.statusCode = 413
    res.end(JSON.stringify({ error: 'Recording is too large' }))
    return
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
  const language =
    typeof payload.language === 'string' ? payload.language.trim().slice(0, 16) : ''
  if (language) form.append('language', language)

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
    res.statusCode = 502
    res.end(
      JSON.stringify({
        error: data.error?.message ?? 'Whisper transcription failed',
      }),
    )
    return
  }

  const text = cleanSpokenText(data.text ?? '')
  res.statusCode = 200
  res.end(
    JSON.stringify({
      text,
      confidence: confidenceFromVerbose(data),
      model: 'whisper-1',
    }),
  )
}
