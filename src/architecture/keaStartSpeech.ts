import type { LanguageCode, TranscriptMessage } from '../types'
import { looksLikeSystemText } from './whisperText'
import { hasUserTalked } from '../data/keaLearnerProfile'

export interface StartSpeechLine {
  spoken: string
  english?: string
  kind: 'welcome' | 'welcome-back'
}

function nameOf(firstName: string) {
  return firstName.trim().split(/\s+/)[0] ?? ''
}

const FIRST_MEET_DONE_KEY = 'kea-first-meet-greeting-done'

function firstMeetDoneKey(userKey = '') {
  return userKey ? `${FIRST_MEET_DONE_KEY}:${userKey}` : FIRST_MEET_DONE_KEY
}

export function hasFirstMeetGreetingDone(userKey = '') {
  try {
    return localStorage.getItem(firstMeetDoneKey(userKey)) === '1'
  } catch {
    return false
  }
}

export function markFirstMeetGreetingDone(userKey = '') {
  try {
    localStorage.setItem(firstMeetDoneKey(userKey), '1')
  } catch {
    // ignore
  }
}

export function clearFirstMeetGreetingDone(userKey = '') {
  try {
    localStorage.removeItem(firstMeetDoneKey(userKey))
    localStorage.removeItem(FIRST_MEET_DONE_KEY)
  } catch {
    // ignore
  }
}

const FIRST_MEET_EN =
  "Hi {name}, nice to meet you. What shall we talk about today? Remember you can say anything, using a mix of your native language and the language you want to learn. Let's try it. Tell me where you live, or your favourite food... anything."

const FIRST_MEET_SPOKEN: Record<string, (n: string) => string> = {
  en: (n) =>
    n
      ? FIRST_MEET_EN.replace('{name}', n)
      : FIRST_MEET_EN.replace('Hi {name}, ', 'Hi, '),
  es: (n) =>
    n
      ? `Hola ${n}, encantada de conocerte. ¿De qué hablamos hoy? Recuerda que puedes decir cualquier cosa, mezclando tu idioma con el que quieres aprender. Vamos a probar. Dime dónde vives, o tu comida favorita... lo que sea.`
      : 'Hola, encantada de conocerte. ¿De qué hablamos hoy? Recuerda que puedes decir cualquier cosa, mezclando tu idioma con el que quieres aprender. Vamos a probar. Dime dónde vives, o tu comida favorita... lo que sea.',
  fr: (n) =>
    n
      ? `Salut ${n}, ravie de te rencontrer. De quoi est-ce qu'on parle aujourd'hui ? Tu peux tout dire, en mélangeant ta langue et celle que tu veux apprendre. On essaie. Dis-moi où tu habites, ou ton plat préféré... n'importe quoi.`
      : "Salut, ravie de te rencontrer. De quoi est-ce qu'on parle aujourd'hui ? Tu peux tout dire, en mélangeant ta langue et celle que tu veux apprendre. On essaie. Dis-moi où tu habites, ou ton plat préféré... n'importe quoi.",
  de: (n) =>
    n
      ? `Hallo ${n}, schön dich kennenzulernen. Worüber sollen wir heute sprechen? Du darfst alles sagen — gemischt in deiner Sprache und der, die du lernen willst. Probieren wir es. Sag mir, wo du wohnst, oder dein Lieblingsessen... irgendetwas.`
      : 'Hallo, schön dich kennenzulernen. Worüber sollen wir heute sprechen? Du darfst alles sagen — gemischt in deiner Sprache und der, die du lernen willst. Probieren wir es. Sag mir, wo du wohnst, oder dein Lieblingsessen... irgendetwas.',
  pt: (n) =>
    n
      ? `Olá ${n}, prazer em conhecer-te. Sobre o que vamos falar hoje? Podes dizer qualquer coisa, misturando a tua língua com a que queres aprender. Vamos tentar. Diz-me onde vives, ou a tua comida favorita... qualquer coisa.`
      : 'Olá, prazer em conhecer-te. Sobre o que vamos falar hoje? Podes dizer qualquer coisa, misturando a tua língua com a que queres aprender. Vamos tentar. Diz-me onde vives, ou a tua comida favorita... qualquer coisa.',
  it: (n) =>
    n
      ? `Ciao ${n}, piacere di conoscerti. Di cosa parliamo oggi? Puoi dire qualsiasi cosa, mescolando la tua lingua e quella che vuoi imparare. Proviamo. Dimmi dove vivi, o il tuo cibo preferito... qualsiasi cosa.`
      : 'Ciao, piacere di conoscerti. Di cosa parliamo oggi? Puoi dire qualsiasi cosa, mescolando la tua lingua e quella che vuoi imparare. Proviamo. Dimmi dove vivi, o il tuo cibo preferito... qualsiasi cosa.',
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

function buildFirstMeetLine(languageCode: LanguageCode, firstName: string): StartSpeechLine {
  const name = nameOf(firstName)
  const make = FIRST_MEET_SPOKEN[languageCode] ?? FIRST_MEET_SPOKEN.en
  const english = name
    ? FIRST_MEET_EN.replace('{name}', name)
    : FIRST_MEET_EN.replace('Hi {name}, ', 'Hi, ')
  return {
    spoken: make(name),
    english: languageCode === 'en' ? undefined : english,
    kind: 'welcome',
  }
}

/** Login / session greeting — first meet once, then short welcome-back. */
export function buildStartSpeechLine(options: {
  languageCode: LanguageCode
  firstName: string
  messages: TranscriptMessage[]
  userKey?: string
}): StartSpeechLine {
  const lang = options.languageCode
  const name = nameOf(options.firstName)
  const userKey = options.userKey ?? ''
  const firstMeet =
    !hasFirstMeetGreetingDone(userKey) &&
    !hasUserTalked() &&
    isFreshTalkSession(options.messages)

  if (firstMeet) {
    return buildFirstMeetLine(lang, options.firstName)
  }

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
