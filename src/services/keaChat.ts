import type { LearnerLevel } from '../types'
import type { TranscriptMessage } from '../types'

export async function askKea(options: {
  nativeLanguage: string
  targetLanguage: string
  level: LearnerLevel
  history: TranscriptMessage[]
  userText: string
}): Promise<string> {
  const messages = [
    ...options.history.map((item) => ({
      role: item.speaker === 'kea' ? ('assistant' as const) : ('user' as const),
      content: item.text,
    })),
    { role: 'user' as const, content: options.userText },
  ]

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nativeLanguage: options.nativeLanguage,
      targetLanguage: options.targetLanguage,
      level: options.level,
      messages,
    }),
  })

  const data = (await response.json()) as { reply?: string; error?: string }
  if (!response.ok || !data.reply) {
    throw new Error(data.error ?? 'KEA could not reply')
  }
  return data.reply
}

export async function translateSpanishToEnglish(text: string): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'translate',
      text,
    }),
  })

  const data = (await response.json()) as {
    translation?: string
    error?: string
  }
  if (!response.ok || !data.translation) {
    throw new Error(data.error ?? 'Translation failed')
  }
  return data.translation
}
