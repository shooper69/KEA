import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_KEA_MASTER_DEFINITION } from '../data/keaMasterDefinition.ts'
import {
  clampAverageReplyWords,
  DEFAULT_AVERAGE_REPLY_WORDS,
  maxTokensForAverageWords,
} from '../data/keaSpeech.ts'
import { buildKeaSystemPrompt } from './keaPrompt.ts'

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  mode?: 'chat' | 'translate' | 'plain-translate'
  nativeLanguage?: string
  targetLanguage?: string
  level?: string
  messages?: ChatTurn[]
  text?: string
  masterDefinition?: string
  aboutKea?: string
  memoryBlock?: string
  averageReplyWords?: number
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

  const averageReplyWords = clampAverageReplyWords(
    payload.averageReplyWords ?? DEFAULT_AVERAGE_REPLY_WORDS,
  )
  const isTranslate = payload.mode === 'translate'
  const isPlainTranslate = payload.mode === 'plain-translate'
  const targetName = payload.targetLanguage?.trim() || 'English'

  if ((isTranslate || isPlainTranslate) && !payload.text?.trim()) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Nothing to translate' }))
    return
  }

  const openaiMessages = isPlainTranslate
    ? [
        {
          role: 'system' as const,
          content: `Translate into natural spoken ${targetName}. Keep first person (I, me, my). Return only the translation — no labels, quotes, or commentary.`,
        },
        {
          role: 'user' as const,
          content: payload.text?.trim() ?? '',
        },
      ]
    : isTranslate
      ? [
          {
            role: 'system' as const,
            content:
              'Translate Spanish into plain, natural English for a language learner. Return only the English. No labels, quotes, or extra commentary. If the text has no Spanish, return it unchanged. Keep mixed English words as they are.',
          },
          {
            role: 'user' as const,
            content: payload.text?.trim() ?? '',
          },
        ]
      : [
          {
            role: 'system' as const,
            content: buildKeaSystemPrompt({
              nativeLanguage: payload.nativeLanguage ?? 'English',
              targetLanguage: payload.targetLanguage ?? 'Spanish',
              level: payload.level ?? 'intermediate',
              masterDefinition:
                payload.masterDefinition?.trim() || DEFAULT_KEA_MASTER_DEFINITION,
              aboutKea: payload.aboutKea,
              memoryBlock: payload.memoryBlock,
              averageReplyWords,
            }),
          },
          ...(payload.messages ?? []),
        ]

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
        temperature: isTranslate || isPlainTranslate ? 0.2 : 0.7,
        max_tokens: isPlainTranslate
          ? 400
          : isTranslate
            ? 200
            : maxTokensForAverageWords(averageReplyWords) + 120,
        messages: openaiMessages,
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
    res.end(JSON.stringify({ error: 'Empty reply from Kea' }))
    return
  }

  res.statusCode = 200
  res.end(
    JSON.stringify(
      isTranslate || isPlainTranslate
        ? { translation: reply }
        : { reply },
    ),
  )
}
