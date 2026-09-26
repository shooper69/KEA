/**
 * Describe the last chat so rejoin / welcome-back can name the subject
 * and nature of the conversation, not just a clipped final utterance.
 */

import {
  isHomeGreetingMessage,
} from '../config/languages'
import type { ChatTopic, TranscriptMessage } from '../types'
import { looksLikeSystemText } from './whisperText'

export interface LastChatRecall {
  /** Short subject for “we were talking about …” */
  topic: string
  /** What the chat was like / where it left off */
  nature: string
  /** One spoken line fragment after “Welcome back.” (no trailing question) */
  spokenAbout: string
  /** English caption for spokenAbout when the learning language is not English */
  englishAbout: string
}

const ACK =
  /^(um+|uh+|hm+|mm+|ah+|oh+|well|so|ok|okay|yeah|yep|yup|yes|no|nah|hi|hey|hello|hola|oui|si|sí|ja|nein|non|gracias|thanks|thank you|vale|claro|bueno|bien|d'accord|daccord|exacto|sure|right|alright|all right)[.!?…]*$/i

const WELCOME_BACK_LINE =
  /welcome back|qu[eé] bueno que volviste|content de te revoir|willkommen zur[uü]ck|с возвращением|pick up where we left|seguimos donde|reprend où|dort weiter|shall we continue|¿seguimos|on continue|machen wir weiter|продолжим/i

function isSampleTopicId(id: string) {
  return id.startsWith('sample-')
}

function cleanText(rawInput: string) {
  return rawInput.replace(/\s+/g, ' ').trim()
}

function isNoise(text: string) {
  const t = cleanText(text)
  if (!t || looksLikeSystemText(t) || WELCOME_BACK_LINE.test(t)) return true
  if (ACK.test(t)) return true
  return false
}

function stripLeadFillers(raw: string) {
  return raw
    .replace(
      /^(um+|uh+|hm+|well|so|ok|okay|yeah|yes|no|hi|hey|hello|hola|bueno|vale|pues|entonces|mira|look|listen)[,.\s]+/i,
      '',
    )
    .trim()
}

/** Prefer an “about X” subject; else a short noun-heavy clause. */
export function subjectPhrase(rawInput: string, maxWords = 8): string {
  let raw = stripLeadFillers(cleanText(rawInput))
  if (!raw || isNoise(raw)) return ''

  const about =
    raw.match(
      /\b(?:talking|speaking|chatting|chat|spoke|speak|habl(?:ando|amos|ar)|parl(?:ant|ions|er)|gesprochen)\s+(?:about|of|de|sobre|über)\s+(.+)$/i,
    )?.[1] ||
    raw.match(/\babout\s+(.+)$/i)?.[1] ||
    raw.match(/\bsobre\s+(.+)$/i)?.[1] ||
    raw.match(/\büber\s+(.+)$/i)?.[1] ||
    raw.match(/\bde\s+(?:tu|su|mi|el|la|los|las|un|una)\s+(.+)$/i)?.[1]

  if (about) raw = about.trim()

  raw = raw
    .replace(
      /^(what|who|where|when|why|how|do|did|does|is|are|was|were|can|could|would|should|qué|como|cómo|dónde|donde|quién|quien|por qué|porque)\b[\s,]+/i,
      '',
    )
    .trim()

  const clause = raw.split(/[.!?¿¡;:]/)[0]?.trim() || raw
  const words = clause.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const nameAt = words.findIndex(
    (w, i) => i > 0 && /^[A-ZÁÉÍÓÚÑÜ][\p{L}'-]+$/u.test(w),
  )
  const focused =
    nameAt >= 0 && words.length > maxWords
      ? words.slice(nameAt, nameAt + maxWords)
      : words.slice(0, maxWords)

  let clipped = focused.join(' ')
  if (words.length > maxWords) clipped = `${clipped}…`
  if (clipped.length > 56) clipped = `${clipped.slice(0, 53).trim()}…`
  return clipped.replace(/^[,.\s]+|[,.\s]+$/g, '')
}

function isShortAckOrGreeting(text: string) {
  const t = cleanText(text)
  if (t.split(/\s+/).length <= 3 && ACK.test(t.replace(/[.!?…]+$/, ''))) {
    return true
  }
  return isNoise(t)
}

function realTurns(messages: TranscriptMessage[]) {
  return messages.filter(
    (item) =>
      item.text.trim() &&
      !item.interim &&
      !isHomeGreetingMessage(item) &&
      !isNoise(item.text),
  )
}

function scoreSubject(phrase: string) {
  if (!phrase) return 0
  const words = phrase.replace(/…/g, '').split(/\s+/).filter(Boolean)
  let score = Math.min(words.length, 6)
  if (words.some((w) => /^[A-ZÁÉÍÓÚÑÜ][\p{L}'-]{2,}$/u.test(w))) score += 4
  if (/\b(my|your|his|her|our|mi|tu|su|mon|ton|mein)\b/i.test(phrase)) {
    score += 2
  }
  if (words.length > 10) score -= 3
  if (/^(i|yo|je|ich|we|nosotros)\b/i.test(phrase)) score -= 1
  return score
}

export function topicLabelFromStored(topic: ChatTopic): string {
  if (isSampleTopicId(topic.id)) return ''
  const candidates = [
    subjectPhrase(topic.nativeTitle || ''),
    subjectPhrase(topic.summary || ''),
    subjectPhrase(topic.title || ''),
  ].filter(Boolean)
  if (candidates.length === 0) return ''
  return candidates.sort((a, b) => scoreSubject(b) - scoreSubject(a))[0]
}

function recallFromTranscript(messages: TranscriptMessage[]): {
  topic: string
  nature: string
} {
  const real = realTurns(messages)
  if (real.length === 0) return { topic: '', nature: '' }

  const recent = real.slice(-10)
  const userTurns = recent
    .filter((item) => item.speaker === 'user')
    .map((item) => cleanText(item.text))
    .filter((text) => !isShortAckOrGreeting(text))
  const keaTurns = recent
    .filter((item) => item.speaker === 'kea')
    .map((item) => cleanText(item.text))
    .filter((text) => !isShortAckOrGreeting(text))

  const subjects = [...userTurns, ...keaTurns]
    .map((text) => subjectPhrase(text))
    .filter(Boolean)
    .sort((a, b) => scoreSubject(b) - scoreSubject(a))

  const topic = subjects[0] || ''

  const lastUser = userTurns[userTurns.length - 1] || ''
  const lastKea = keaTurns[keaTurns.length - 1] || ''

  let nature = ''
  if (lastUser) {
    const snippet = subjectPhrase(lastUser, 10) || clipWords(lastUser, 10)
    if (snippet && snippet.toLowerCase() !== topic.toLowerCase()) {
      nature = `you were saying ${snippet}`
    } else if (snippet) {
      nature = 'we had not finished that thought'
    }
  } else if (lastKea) {
    const snippet = subjectPhrase(lastKea, 10) || clipWords(lastKea, 10)
    if (snippet && snippet.toLowerCase() !== topic.toLowerCase()) {
      nature = `I had just asked about ${snippet}`
    }
  }

  if (!topic && lastUser) {
    return {
      topic: clipWords(lastUser, 8),
      nature: 'picking up that thread',
    }
  }

  return { topic, nature }
}

function clipWords(text: string, maxWords: number) {
  const words = stripLeadFillers(cleanText(text)).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}…`
}

function mergeRecall(
  storedTopic: string,
  fromChat: { topic: string; nature: string },
  storedSummary: string,
): LastChatRecall {
  const topic =
    [storedTopic, fromChat.topic]
      .filter(Boolean)
      .sort((a, b) => scoreSubject(b) - scoreSubject(a))[0] || ''

  let nature = fromChat.nature
  const summaryBit = subjectPhrase(storedSummary, 10)
  if (
    summaryBit &&
    topic &&
    summaryBit.toLowerCase() !== topic.toLowerCase() &&
    !nature
  ) {
    nature = summaryBit
  } else if (
    summaryBit &&
    nature &&
    scoreSubject(summaryBit) > scoreSubject(nature) + 2
  ) {
    if (!/^you were saying /i.test(nature) || summaryBit.length < nature.length) {
      nature = summaryBit.startsWith('talk')
        ? summaryBit
        : `it was about ${summaryBit}`
    }
  }

  if (!topic && !nature) {
    return {
      topic: '',
      nature: '',
      spokenAbout: '',
      englishAbout: '',
    }
  }

  const spokenAbout = topic
    ? nature
      ? `We were talking about ${topic} — ${nature}`
      : `We were talking about ${topic}`
    : nature
      ? `Last time ${nature}`
      : ''

  return {
    topic,
    nature,
    spokenAbout,
    englishAbout: spokenAbout,
  }
}

/** Full recall used for welcome-back speech and prompt context. */
export function describeLastChat(
  messages: TranscriptMessage[],
  options?: {
    openTopic?: ChatTopic | null
    recentTopics?: ChatTopic[]
  },
): LastChatRecall {
  const open = options?.openTopic ?? null
  const storedTopic = open ? topicLabelFromStored(open) : ''
  const storedSummary = open
    ? open.nativeTitle || open.summary || open.title || ''
    : ''
  const fromChat = recallFromTranscript(messages)
  let recall = mergeRecall(storedTopic, fromChat, storedSummary)

  if (!recall.topic && !recall.nature) {
    const topics = (options?.recentTopics ?? []).filter(
      (t) => !isSampleTopicId(t.id),
    )
    for (const topic of topics) {
      const label = topicLabelFromStored(topic)
      if (label) {
        recall = mergeRecall(
          label,
          { topic: '', nature: '' },
          topic.nativeTitle || topic.summary || '',
        )
        break
      }
    }
  }

  return recall
}

/** Prefer a stable subject phrase over a raw sentence dump. */
export function preferTopicLabel(current: string, next: string) {
  const a = subjectPhrase(current) || cleanText(current)
  const b = subjectPhrase(next) || cleanText(next)
  if (!b) return a
  if (!a) return b
  return scoreSubject(b) >= scoreSubject(a) ? b : a
}

/** Prompt block so the model also understands the prior thread. */
export function lastChatRecallPromptBlock(
  messages: TranscriptMessage[],
  options?: {
    openTopic?: ChatTopic | null
    recentTopics?: ChatTopic[]
  },
) {
  const recall = describeLastChat(messages, options)
  if (!recall.topic && !recall.nature) return ''
  const lines = [
    'LAST CHAT RECALL (use when welcoming back or continuing after silence; do not restart as a first meeting):',
  ]
  if (recall.topic) lines.push(`- Subject: ${recall.topic}`)
  if (recall.nature) lines.push(`- Where it left off: ${recall.nature}`)
  lines.push(
    '- On rejoin: welcome them back, briefly name this subject and the nature of that chat in one short beat, then continue from there.',
  )
  return `${lines.join('\n')}\n\n`
}
