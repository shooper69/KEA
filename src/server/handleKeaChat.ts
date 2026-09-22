import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildKeaSystemPrompt } from './keaPrompt.ts'

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  nativeLanguage: string
  targetLanguage: string
  level: string
  messages: ChatTurn[]
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export async function handleKeaChat(
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

  let payload: ChatRequest
  try {
    payload = JSON.parse(await readBody(req)) as ChatRequest
  } catch {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Invalid JSON' }))
    return
  }

  const openaiResponse = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: buildKeaSystemPrompt({
              nativeLanguage: payload.nativeLanguage,
              targetLanguage: payload.targetLanguage,
              level: payload.level ?? 'intermediate',
            }),
          },
          ...payload.messages,
        ],
      }),
    },
  )

  const data = (await openaiResponse.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!openaiResponse.ok) {
    res.statusCode = 502
    res.end(
      JSON.stringify({
        error: data.error?.message ?? 'OpenAI request failed',
      }),
    )
    return
  }

  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    res.statusCode = 502
    res.end(JSON.stringify({ error: 'Empty reply from KEA' }))
    return
  }

  res.statusCode = 200
  res.end(JSON.stringify({ reply }))
}
