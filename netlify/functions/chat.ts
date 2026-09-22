type ChatEvent = {
  httpMethod: string
  body: string | null
}

function systemPrompt(
  nativeLanguage: string,
  targetLanguage: string,
  level: string,
) {
  return `You are KEA, a patient, intelligent and encouraging language tutor.
Your job is to help users learn through natural conversation, like a foreign friend chatting about life.

Rules:
- Speak primarily in ${targetLanguage}.
- Keep language appropriate to a ${level} learner.
- Gently correct mistakes, then continue the conversation.
- Encourage conversation rather than lectures.
- Keep responses concise and natural (two to five short sentences).
- Explain grammar only when necessary.
- If the learner is struggling, temporarily switch to ${nativeLanguage} to help understanding, then return to ${targetLanguage}.
- Always end in a way that invites another spoken reply.
- The learner's native language is ${nativeLanguage}.`
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
    mode?: 'chat' | 'translate'
    nativeLanguage: string
    targetLanguage: string
    level: string
    text?: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  try {
    payload = JSON.parse(event.body ?? '{}') as typeof payload
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const isTranslate = payload.mode === 'translate'
  if (isTranslate && !payload.text?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nothing to translate' }) }
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
        temperature: isTranslate ? 0.2 : 0.7,
        messages: isTranslate
          ? [
              {
                role: 'system',
                content:
                  'Translate Spanish into plain, natural English for a language learner. Return only the English. No labels, quotes, or extra commentary. If the text has no Spanish, return it unchanged. Keep mixed English words as they are.',
              },
              { role: 'user', content: payload.text?.trim() ?? '' },
            ]
          : [
              {
                role: 'system',
                content: systemPrompt(
                  payload.nativeLanguage,
                  payload.targetLanguage,
                  payload.level ?? 'intermediate',
                ),
              },
              ...(payload.messages ?? []),
            ],
      }),
    },
  )

  const data = (await openaiResponse.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!openaiResponse.ok) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: data.error?.message ?? 'OpenAI request failed',
      }),
    }
  }

  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Empty reply from KEA' }) }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(isTranslate ? { translation: reply } : { reply }),
  }
}
