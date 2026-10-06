import { DEFAULT_KEA_MASTER_DEFINITION } from '../../src/data/keaMasterDefinition'
import {
  clampAverageReplyWords,
  DEFAULT_AVERAGE_REPLY_WORDS,
  maxTokensForAverageWords,
} from '../../src/data/keaSpeech'
import { isPublicPlainTranslateAllowed } from '../../src/server/keaPublicSpendGate'
import {
  allowAuthenticatedChat,
  allowPublicSpend,
  chatPayloadTooLarge,
  clientIpFromHeaders,
} from '../../src/server/keaPublicRateLimit'
import { requireKeaUser } from '../../src/server/keaUserAuth'
import {
  requireKeaTalkAccess,
  talkAccessEnvFromProcess,
} from '../../src/server/keaTalkAccessGate'
import { buildKeaSystemPrompt } from '../../src/server/keaPrompt'
import {
  actorForEmail,
  logAiUsage,
  lookupPlanIdAtTime,
  openaiRequestId,
  type AiUsageFeature,
} from '../../src/server/aiUsage/logAiUsage'

type ChatEvent = {
  httpMethod: string
  body: string | null
  headers?: Record<string, string | undefined>
}

export async function handler(event: ChatEvent) {
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

  let payload: {
    mode?: 'chat' | 'translate' | 'plain-translate'
    nativeLanguage?: string
    targetLanguage?: string
    level?: string
    text?: string
    masterDefinition?: string
    aboutKea?: string
    bannedTopicsBlock?: string
    memoryBlock?: string
    learnerProfile?: string
    learnerName?: string
    averageReplyWords?: number
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  try {
    payload = JSON.parse(event.body ?? '{}') as typeof payload
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const publicOk = isPublicPlainTranslateAllowed(payload)
  const ip = clientIpFromHeaders(event.headers)
  let userId: string | null = null
  let userEmail: string | null = null
  if (publicOk) {
    if (!allowPublicSpend(`chat-public:${ip}`, 30)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many requests. Try again shortly.' }),
      }
    }
  } else {
    const auth = await requireKeaUser(event.headers)
    if (!auth.ok) {
      return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) }
    }
    userId = auth.userId
    userEmail = auth.email
    const access = await requireKeaTalkAccess(talkAccessEnvFromProcess(), auth)
    if (!access.ok) {
      return {
        statusCode: access.status,
        body: JSON.stringify({ error: access.error }),
      }
    }
    if (!allowAuthenticatedChat(auth.userId, ip)) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many requests. Try again shortly.' }),
      }
    }
  }

  const oversized = chatPayloadTooLarge(payload)
  if (oversized) {
    return { statusCode: 413, body: JSON.stringify({ error: oversized }) }
  }

  const averageReplyWords = clampAverageReplyWords(
    payload.averageReplyWords ?? DEFAULT_AVERAGE_REPLY_WORDS,
  )
  const isTranslate = payload.mode === 'translate'
  const isPlainTranslate = payload.mode === 'plain-translate'
  const targetName = payload.targetLanguage?.trim() || 'English'
  if ((isTranslate || isPlainTranslate) && !payload.text?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nothing to translate' }) }
  }

  const openaiMessages = isPlainTranslate
    ? [
        {
          role: 'system' as const,
          content: `Translate into natural spoken ${targetName}. Keep first person (I, me, my). Return only the translation — no labels, quotes, or commentary.`,
        },
        { role: 'user' as const, content: payload.text?.trim() ?? '' },
      ]
    : isTranslate
      ? [
          {
            role: 'system' as const,
            content:
              'Translate Spanish into plain, natural English for a language learner. Return only the English. No labels, quotes, or extra commentary. If the text has no Spanish, return it unchanged. Keep mixed English words as they are.',
          },
          { role: 'user' as const, content: payload.text?.trim() ?? '' },
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
              bannedTopicsBlock: payload.bannedTopicsBlock,
              memoryBlock: payload.memoryBlock,
              learnerProfile: payload.learnerProfile,
              learnerName: payload.learnerName,
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
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const feature: AiUsageFeature = isPlainTranslate
    ? userId
      ? 'translation'
      : 'plain_translation'
    : isTranslate
      ? 'translation'
      : 'conversation_chat'
  const usageBase = {
    userId,
    userEmail,
    actor: actorForEmail(userId, userEmail),
    feature,
    requestType: 'chat_completions' as const,
    model: 'gpt-4o-mini',
    planIdAtTime: await lookupPlanIdAtTime(userId),
    promptTokens: Number(data.usage?.prompt_tokens) || 0,
    completionTokens: Number(data.usage?.completion_tokens) || 0,
    requestId: openaiRequestId(openaiResponse),
  }

  if (!openaiResponse.ok) {
    logAiUsage({ ...usageBase, status: 'error' })
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: data.error?.message ?? 'OpenAI request failed',
      }),
    }
  }

  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    logAiUsage({ ...usageBase, status: 'error' })
    return { statusCode: 502, body: JSON.stringify({ error: 'Empty reply from Kea' }) }
  }

  logAiUsage({ ...usageBase, status: 'ok' })

  return {
    statusCode: 200,
    body: JSON.stringify(
      isTranslate || isPlainTranslate ? { translation: reply } : { reply },
    ),
  }
}
