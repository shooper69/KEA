import { memoryPromptBlock } from '../architecture/companionMemory'
import { getAboutKea } from '../data/keaAbout'
import { bannedTopicsPromptBlock } from '../data/keaBannedTopics'
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

/** Tell Kea to use the person's name at the start and often, not on every line. */
export function keaNameCue(firstName: string, history: TranscriptMessage[]) {
  const name = firstName.trim().split(/\s+/)[0] ?? ''
  if (!name) return ''
  const lastKea = [...history]
    .reverse()
    .find((item) => item.speaker === 'kea' && item.text.trim())
  const used = Boolean(lastKea?.text.toLowerCase().includes(name.toLowerCase()))
  if (used) {
    return `The person's name is ${name}. You used it in your last line. Leave it out of this reply, then use it again soon. Speak like a friend, not a form.`
  }
  return `The person's name is ${name}. Use ${name} once in this reply, naturally, the way a friend would. Do not begin every sentence with the name.`
}

export async function askKea(options: {
  nativeLanguage: string
  targetLanguage: string
  level: LearnerLevel
  history: TranscriptMessage[]
  userText: string
  learnerProfile?: string
  learnerName?: string
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
      bannedTopicsBlock: bannedTopicsPromptBlock(),
      memoryBlock: memoryPromptBlock(userText, options.history),
      learnerProfile: options.learnerProfile,
      learnerName: options.learnerName,
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

export async function glossLearnWord(
  term: string,
  targetLanguageName: string,
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'plain-translate',
      targetLanguage: targetLanguageName,
      text: term.trim(),
    }),
  })
  const data = (await response.json()) as { translation?: string; error?: string }
  if (!response.ok || !data.translation) {
    throw new Error(data.error ?? 'Translation failed')
  }
  return data.translation.trim()
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
