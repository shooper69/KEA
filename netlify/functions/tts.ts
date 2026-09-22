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

type TtsEvent = {
  httpMethod: string
  body: string | null
  isBase64Encoded?: boolean
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

  let payload: { voice?: string; text?: string }
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

  const openaiResponse = await requestSpeech(apiKey, voice, text)

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
