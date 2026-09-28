import type { LanguageCode, TranscriptMessage } from '../types'
import { looksLikeSystemText } from './whisperText'

export interface StartSpeechLine {
  spoken: string
  english?: string
  kind: 'welcome' | 'welcome-back'
}

function nameOf(firstName: string) {
  return firstName.trim().split(/\s+/)[0] ?? ''
}

const WELCOME_BACK_SIMPLE: Record<string, (n: string) => string> = {
  en: (n) =>
    n
      ? `Welcome back ${n}, what shall we talk about today?`
      : 'Welcome back, what shall we talk about today?',
  es: (n) =>
    n
      ? `Bienvenido de nuevo ${n}, ¿de qué hablamos hoy?`
      : 'Bienvenido de nuevo, ¿de qué hablamos hoy?',
  fr: (n) =>
    n
      ? `Content de te revoir ${n}, de quoi est-ce qu'on parle aujourd'hui ?`
      : "Content de te revoir, de quoi est-ce qu'on parle aujourd'hui ?",
  de: (n) =>
    n
      ? `Willkommen zurück ${n}, worüber sollen wir heute sprechen?`
      : 'Willkommen zurück, worüber sollen wir heute sprechen?',
  pt: (n) =>
    n
      ? `Bem-vindo de volta ${n}, sobre o que vamos falar hoje?`
      : 'Bem-vindo de volta, sobre o que vamos falar hoje?',
  it: (n) =>
    n
      ? `Bentornato ${n}, di cosa parliamo oggi?`
      : 'Bentornato, di cosa parliamo oggi?',
  nl: (n) =>
    n
      ? `Welkom terug ${n}, waar zullen we het vandaag over hebben?`
      : 'Welkom terug, waar zullen we het vandaag over hebben?',
  pl: (n) =>
    n
      ? `Witaj z powrotem ${n}, o czym porozmawiamy dzisiaj?`
      : 'Witaj z powrotem, o czym porozmawiamy dzisiaj?',
  ru: (n) =>
    n
      ? `С возвращением, ${n}, о чём поговорим сегодня?`
      : 'С возвращением, о чём поговорим сегодня?',
}

/** A previous rejoin line, including older stacked welcomes. */
export function isRejoinWelcomeLine(text: string) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t || t.length > 180) return false
  return /welcome back|bienvenid[oa] de nuevo|qu[eé] bueno que volviste|what shall we talk about|de qu[eé] hablamos|content de te revoir|willkommen zur[uü]ck|bem-vindo de volta|bentornat|welkom terug|witaj z powrotem|с возвращением/i.test(
    t,
  )
}

export function withoutRejoinWelcomes<T extends { speaker: string; text: string; english?: string }>(
  messages: T[],
): T[] {
  return messages.filter(
    (item) =>
      item.speaker !== 'kea' ||
      (!isRejoinWelcomeLine(item.text) &&
        !(item.english && isRejoinWelcomeLine(item.english))),
  )
}

export function isFreshTalkSession(messages: TranscriptMessage[]) {
  const real = messages.filter(
    (item) => item.text.trim() && !looksLikeSystemText(item.text),
  )
  return real.length === 0
}

/** Login / session greeting — one short welcome, then an invitation to talk. */
export function buildStartSpeechLine(options: {
  languageCode: LanguageCode
  firstName: string
  messages: TranscriptMessage[]
}): StartSpeechLine {
  const lang = options.languageCode
  const name = nameOf(options.firstName)
  const make = WELCOME_BACK_SIMPLE[lang] ?? WELCOME_BACK_SIMPLE.en
  const english = name
    ? `Welcome back ${name}, what shall we talk about today?`
    : 'Welcome back, what shall we talk about today?'
  return {
    spoken: make(name),
    english: lang === 'en' ? undefined : english,
    kind: 'welcome-back',
  }
}
