import {
  isHomeGreetingMessage,
  spokenHomeGreeting,
} from '../config/languages'
import type { LanguageCode, TranscriptMessage } from '../types'
import { getChatTopics, getOpenChatTopic } from './companionMemory'
import { looksLikeSystemText } from './whisperText'

export interface StartSpeechLine {
  spoken: string
  english?: string
  kind: 'welcome' | 'welcome-back'
}

function nameOf(firstName: string) {
  return firstName.trim().split(/\s+/)[0] ?? ''
}

const WELCOME_VARIANTS: Record<
  string,
  Array<(name: string) => { spoken: string; english: string }>
> = {
  en: [
    (name) => ({
      spoken: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
    (name) => ({
      spoken: name ? `Hello ${name}! Nice to hear you.` : 'Hello! Nice to hear you.',
      english: name ? `Hello ${name}! Nice to hear you.` : 'Hello! Nice to hear you.',
    }),
    (name) => ({
      spoken: name ? `Hey ${name}, how's your day going?` : "Hey, how's your day going?",
      english: name ? `Hey ${name}, how's your day going?` : "Hey, how's your day going?",
    }),
  ],
  es: [
    (name) => ({
      spoken: name ? `Hola ${name}, ¿cómo estás hoy?` : 'Hola, ¿cómo estás hoy?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
    (name) => ({
      spoken: name ? `¡Hola ${name}! Qué gusto oírte.` : '¡Hola! Qué gusto oírte.',
      english: name ? `Hello ${name}! Nice to hear you.` : 'Hello! Nice to hear you.',
    }),
    (name) => ({
      spoken: name
        ? `Hola ${name}, ¿qué tal tu día?`
        : 'Hola, ¿qué tal tu día?',
      english: name ? `Hi ${name}, how's your day going?` : "Hi, how's your day going?",
    }),
  ],
  fr: [
    (name) => ({
      spoken: name
        ? `Bonjour ${name}, comment vas-tu aujourd'hui ?`
        : "Bonjour, comment vas-tu aujourd'hui ?",
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
    (name) => ({
      spoken: name
        ? `Salut ${name} ! Content de t'entendre.`
        : "Salut ! Content de t'entendre.",
      english: name ? `Hi ${name}! Nice to hear you.` : 'Hi! Nice to hear you.',
    }),
  ],
  de: [
    (name) => ({
      spoken: name
        ? `Hallo ${name}, wie geht's dir heute?`
        : "Hallo, wie geht's dir heute?",
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
    (name) => ({
      spoken: name
        ? `Hey ${name}! Schön, dich zu hören.`
        : 'Hey! Schön, dich zu hören.',
      english: name ? `Hey ${name}! Nice to hear you.` : 'Hey! Nice to hear you.',
    }),
  ],
  it: [
    (name) => ({
      spoken: name ? `Ciao ${name}, come stai oggi?` : 'Ciao, come stai oggi?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
  ],
  pt: [
    (name) => ({
      spoken: name ? `Olá ${name}, como estás hoje?` : 'Olá, como estás hoje?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
  ],
  nl: [
    (name) => ({
      spoken: name
        ? `Hoi ${name}, hoe gaat het vandaag?`
        : 'Hoi, hoe gaat het vandaag?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
  ],
  pl: [
    (name) => ({
      spoken: name
        ? `Cześć ${name}, jak się dziś masz?`
        : 'Cześć, jak się dziś masz?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
  ],
  bg: [
    (name) => ({
      spoken: name
        ? `Здравей, ${name}, как си днес?`
        : 'Здравей, как си днес?',
      english: name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?',
    }),
  ],
}

function isSampleTopicId(id: string) {
  return id.startsWith('sample-')
}

function isWelcomeBackLine(text: string) {
  return /welcome back|qu[eé] bueno que volviste|content de te revoir|willkommen zur[uü]ck|с возвращением|pick up where we left|seguimos donde|reprend où|dort weiter/i.test(
    text,
  )
}

/** Short phrase suitable for “we were talking about …”. */
function topicLabel(rawInput: string) {
  let raw = rawInput.replace(/\s+/g, ' ').trim()
  if (!raw || looksLikeSystemText(raw) || isWelcomeBackLine(raw)) return ''
  raw = raw.replace(
    /^(um+|uh+|well|so|ok|okay|yeah|yes|no|hi|hey|hello)[,.\s]+/i,
    '',
  )
  const about =
    raw.match(/\babout\s+(.+)$/i)?.[1] ||
    raw.match(/\bsobre\s+(.+)$/i)?.[1] ||
    raw.match(/\bde\s+(.+)$/i)?.[1]
  if (about) raw = about.trim()
  const clause = raw.split(/[.!?¿¡]/)[0]?.trim() || raw
  const words = clause.split(/\s+/).filter(Boolean)
  const clipped =
    words.length > 8 ? `${words.slice(0, 8).join(' ')}…` : clause
  const cut = clipped.length > 48 ? `${clipped.slice(0, 45).trim()}…` : clipped
  return cut.replace(/^[,.\s]+|[,.\s]+$/g, '')
}

function topicFromStored(topic: {
  id?: string
  title: string
  nativeTitle?: string
  summary?: string
}) {
  if (topic.id && isSampleTopicId(topic.id)) return ''
  return (
    topicLabel(topic.nativeTitle || '') ||
    topicLabel(topic.summary || '') ||
    topicLabel(topic.title || '')
  )
}

/** Prefer the learner’s last real turn, then Kea’s last real reply. */
function recallFromTranscript(messages: TranscriptMessage[]): string {
  const real = messages.filter(
    (item) =>
      item.text.trim() &&
      !item.interim &&
      !isHomeGreetingMessage(item) &&
      !looksLikeSystemText(item.text) &&
      !isWelcomeBackLine(item.text),
  )
  if (real.length === 0) return ''
  const lastUser = [...real].reverse().find((item) => item.speaker === 'user')
  if (lastUser) {
    const label = topicLabel(lastUser.text)
    if (label) return label
  }
  const lastKea = [...real].reverse().find((item) => item.speaker === 'kea')
  if (lastKea) {
    const label = topicLabel(lastKea.text)
    if (label) return label
  }
  return ''
}

function recentTopicPhrase(messages: TranscriptMessage[]): string {
  const open = getOpenChatTopic()
  if (open) {
    const label = topicFromStored(open)
    if (label) return label
  }
  const fromChat = recallFromTranscript(messages)
  if (fromChat) return fromChat
  const topics = getChatTopics().filter((topic) => !isSampleTopicId(topic.id))
  for (const topic of topics) {
    const label = topicFromStored(topic)
    if (label) return label
  }
  return ''
}

const WELCOME_BACK: Record<
  string,
  {
    withTopic: (topic: string) => { spoken: string; english: string }
    plain: () => { spoken: string; english: string }
  }
> = {
  en: {
    withTopic: (topic) => ({
      spoken: `Welcome back. We were talking about ${topic}. Shall we continue?`,
      english: `Welcome back. We were talking about ${topic}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Welcome back. Shall we pick up where we left off?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  es: {
    withTopic: (topic) => ({
      spoken: `¡Qué bueno que volviste! Estábamos hablando de ${topic}. ¿Seguimos?`,
      english: `Welcome back. We were talking about ${topic}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: '¡Qué bueno que volviste! ¿Seguimos donde lo dejamos?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  fr: {
    withTopic: (topic) => ({
      spoken: `Content de te revoir. On parlait de ${topic}. On continue ?`,
      english: `Welcome back. We were talking about ${topic}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Content de te revoir. On reprend où on s’était arrêté ?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  de: {
    withTopic: (topic) => ({
      spoken: `Willkommen zurück. Wir haben über ${topic} gesprochen. Machen wir weiter?`,
      english: `Welcome back. We were talking about ${topic}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Willkommen zurück. Machen wir dort weiter, wo wir aufgehört haben?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  ru: {
    withTopic: (topic) => ({
      spoken: `С возвращением. Мы говорили о ${topic}. Продолжим?`,
      english: `Welcome back. We were talking about ${topic}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'С возвращением. Продолжим с того места, где остановились?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
}

export function isFreshTalkSession(messages: TranscriptMessage[]) {
  const real = messages.filter(
    (item) => item.text.trim() && !looksLikeSystemText(item.text),
  )
  if (real.length === 0) return true
  return real.every((item) => isHomeGreetingMessage(item))
}

export function buildStartSpeechLine(options: {
  languageCode: LanguageCode
  firstName: string
  messages: TranscriptMessage[]
}): StartSpeechLine {
  const lang = options.languageCode
  const name = nameOf(options.firstName)
  const fresh = isFreshTalkSession(options.messages)

  if (fresh) {
    const variants = WELCOME_VARIANTS[lang] ?? WELCOME_VARIANTS.en
    const pick = variants[Math.floor(Math.random() * variants.length)]
    const line = pick(name)
    // Fallback if somehow empty
    if (!line.spoken.trim()) {
      const spoken = spokenHomeGreeting(lang, name)
      return {
        spoken,
        english: lang === 'en' ? undefined : spokenHomeGreeting('en', name),
        kind: 'welcome',
      }
    }
    return {
      spoken: line.spoken,
      english: lang === 'en' ? undefined : line.english,
      kind: 'welcome',
    }
  }

  const topic = recentTopicPhrase(options.messages)
  const pack = WELCOME_BACK[lang] ?? WELCOME_BACK.en
  const line = topic ? pack.withTopic(topic) : pack.plain()
  return {
    spoken: line.spoken,
    english: lang === 'en' ? undefined : line.english,
    kind: 'welcome-back',
  }
}
