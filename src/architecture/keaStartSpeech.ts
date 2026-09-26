import {
  isHomeGreetingMessage,
  spokenHomeGreeting,
} from '../config/languages'
import type { LanguageCode, TranscriptMessage } from '../types'
import { getChatTopics, getOpenChatTopic } from './companionMemory'
import { describeLastChat } from './keaChatRecall'
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

const WELCOME_BACK: Record<
  string,
  {
    withAbout: (about: string) => { spoken: string; english: string }
    plain: () => { spoken: string; english: string }
  }
> = {
  en: {
    withAbout: (about) => ({
      spoken: `Welcome back. ${about}. Shall we continue?`,
      english: `Welcome back. ${about}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Welcome back. Shall we pick up where we left off?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  es: {
    withAbout: (about) => ({
      spoken: `¡Qué bueno que volviste! ${about}. ¿Seguimos?`,
      english: `Welcome back. ${about}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: '¡Qué bueno que volviste! ¿Seguimos donde lo dejamos?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  fr: {
    withAbout: (about) => ({
      spoken: `Content de te revoir. ${about}. On continue ?`,
      english: `Welcome back. ${about}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Content de te revoir. On reprend où on s’était arrêté ?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  de: {
    withAbout: (about) => ({
      spoken: `Willkommen zurück. ${about}. Machen wir weiter?`,
      english: `Welcome back. ${about}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'Willkommen zurück. Machen wir dort weiter, wo wir aufgehört haben?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
  ru: {
    withAbout: (about) => ({
      spoken: `С возвращением. ${about}. Продолжим?`,
      english: `Welcome back. ${about}. Shall we continue?`,
    }),
    plain: () => ({
      spoken: 'С возвращением. Продолжим с того места, где остановились?',
      english: 'Welcome back. Shall we pick up where we left off?',
    }),
  },
}

/** Localize the English recall beat into the learning language when we can. */
function localizeAbout(
  lang: string,
  recall: { topic: string; nature: string; spokenAbout: string },
): { spoken: string; english: string } {
  const topic = recall.topic
  const nature = recall.nature
  const english = recall.spokenAbout

  if (lang === 'en' || !topic) {
    return { spoken: english, english }
  }

  if (lang === 'es') {
    const spoken = nature
      ? nature.startsWith('you were saying')
        ? `Estábamos hablando de ${topic} — decías ${nature.replace(/^you were saying\s+/i, '')}`
        : nature.startsWith('I had just asked')
          ? `Estábamos hablando de ${topic} — te preguntaba por ${nature.replace(/^I had just asked about\s+/i, '')}`
          : `Estábamos hablando de ${topic} — ${nature}`
      : `Estábamos hablando de ${topic}`
    return { spoken, english }
  }

  if (lang === 'fr') {
    const spoken = nature
      ? nature.startsWith('you were saying')
        ? `On parlait de ${topic} — tu disais ${nature.replace(/^you were saying\s+/i, '')}`
        : `On parlait de ${topic} — ${nature}`
      : `On parlait de ${topic}`
    return { spoken, english }
  }

  if (lang === 'de') {
    const spoken = nature
      ? nature.startsWith('you were saying')
        ? `Wir haben über ${topic} gesprochen — du hast gesagt ${nature.replace(/^you were saying\s+/i, '')}`
        : `Wir haben über ${topic} gesprochen — ${nature}`
      : `Wir haben über ${topic} gesprochen`
    return { spoken, english }
  }

  if (lang === 'ru') {
    const spoken = nature
      ? `Мы говорили о ${topic} — ${nature}`
      : `Мы говорили о ${topic}`
    return { spoken, english }
  }

  return { spoken: english, english }
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

  const recall = describeLastChat(options.messages, {
    openTopic: getOpenChatTopic(),
    recentTopics: getChatTopics(),
  })
  const pack = WELCOME_BACK[lang] ?? WELCOME_BACK.en
  if (recall.spokenAbout) {
    const about = localizeAbout(lang, recall)
    const line = pack.withAbout(about.spoken)
    return {
      spoken: line.spoken,
      english: lang === 'en' ? undefined : pack.withAbout(about.english).english,
      kind: 'welcome-back',
    }
  }

  const line = pack.plain()
  return {
    spoken: line.spoken,
    english: lang === 'en' ? undefined : line.english,
    kind: 'welcome-back',
  }
}
