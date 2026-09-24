import { memoryPromptBlock } from '../architecture/companionMemory'
import { getAboutKea } from '../data/keaAbout'
import { getMasterDefinition } from '../data/keaMasterDefinition'
import { getAverageReplyWords } from '../data/keaSpeech'
import type { LearnerLevel } from '../types'
import type { TranscriptMessage } from '../types'

const MAX_HISTORY_TURNS = 16
const MAX_TURN_CHARS = 480

function clipTurn(text: string) {
  const trimmed = text.trim()
  if (trimmed.length <= MAX_TURN_CHARS) return trimmed
  return trimmed.slice(-MAX_TURN_CHARS).replace(/^\S*\s+/, '')
}

export async function askKea(options: {
  nativeLanguage: string
  targetLanguage: string
  level: LearnerLevel
  history: TranscriptMessage[]
  userText: string
}): Promise<string> {
  const history = options.history
    .filter((item) => item.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((item) => ({
      role: item.speaker === 'kea' ? ('assistant' as const) : ('user' as const),
      content: clipTurn(item.text),
    }))
  const userText = clipTurn(options.userText)
  const last = history[history.length - 1]
  const messages =
    last?.role === 'user' && last.content === userText
      ? history
      : [...history, { role: 'user' as const, content: userText }]

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nativeLanguage: options.nativeLanguage,
      targetLanguage: options.targetLanguage,
      level: options.level,
      masterDefinition: getMasterDefinition(),
      aboutKea: getAboutKea(),
      memoryBlock: memoryPromptBlock(userText),
      averageReplyWords: getAverageReplyWords(),
      messages,
    }),
  })

  const data = (await response.json()) as { reply?: string; error?: string }
  if (!response.ok || !data.reply) {
    throw new Error(data.error ?? 'Kea could not reply')
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
