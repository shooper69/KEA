import type { IncomingMessage, ServerResponse } from 'node:http'

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

async function requestSpeech(apiKey: string, voice: string, text: string) {
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
      model: 'tts-1',
      voice,
      input: text,
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

  let payload: { voice?: string; text?: string }
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

  const openaiResponse = await requestSpeech(apiKey, voice, text)

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
