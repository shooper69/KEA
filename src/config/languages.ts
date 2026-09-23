import type { LanguageCode, LanguageOption, TranscriptMessage } from '../types'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechLocale: 'en-GB' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechLocale: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', speechLocale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechLocale: 'de-DE' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', speechLocale: 'ru-RU' },
]

/** Stable id so Talk can detect the seeded home greeting without duplicates. */
export const HOME_GREETING_ID = 'kea-home-greeting'

function greetingFirstName(firstName: string): string {
  return firstName.trim().split(/\s+/)[0] ?? ''
}

function englishHomeGreeting(name: string): string {
  return name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?'
}

const HOME_GREETING_SPOKEN: Record<string, (name: string) => string> = {
  en: (name) => (name ? `Hi ${name}, how are you today?` : 'Hi, how are you today?'),
  es: (name) => (name ? `Hola ${name}, ¿cómo estás hoy?` : 'Hola, ¿cómo estás hoy?'),
  fr: (name) =>
    name
      ? `Bonjour ${name}, comment vas-tu aujourd'hui ?`
      : "Bonjour, comment vas-tu aujourd'hui ?",
  de: (name) =>
    name ? `Hallo ${name}, wie geht's dir heute?` : "Hallo, wie geht's dir heute?",
  ru: (name) =>
    name ? `Привет, ${name}, как дела сегодня?` : 'Привет, как дела сегодня?',
  it: (name) => (name ? `Ciao ${name}, come stai oggi?` : 'Ciao, come stai oggi?'),
  pt: (name) =>
    name ? `Olá ${name}, como você está hoje?` : 'Olá, como você está hoje?',
}

export function spokenHomeGreeting(languageCode: string, firstName: string): string {
  const name = greetingFirstName(firstName)
  const make = HOME_GREETING_SPOKEN[languageCode] ?? HOME_GREETING_SPOKEN.en
  return make(name)
}

export function createHomeGreetingMessage(
  languageCode: LanguageCode | string,
  firstName: string,
): TranscriptMessage {
  const name = greetingFirstName(firstName)
  const text = spokenHomeGreeting(languageCode, name)
  return {
    id: HOME_GREETING_ID,
    speaker: 'kea',
    text,
    english: languageCode === 'en' ? undefined : englishHomeGreeting(name),
  }
}

const HOME_GREETING_ENGLISH = /^Hi( [^,]+)?, how are you today\?$/
const HOME_GREETING_SPOKEN_END = [
  /¿cómo estás hoy\??$/i,
  /comment vas-tu aujourd'hui \?$/i,
  /wie geht's dir heute\?$/i,
  /как дела сегодня\?$/i,
  /come stai oggi\?$/i,
  /como você está hoje\?$/i,
  /how are you today\?$/i,
]

export function isHomeGreetingMessage(message: TranscriptMessage | undefined): boolean {
  if (!message || message.speaker !== 'kea') return false
  if (message.id === HOME_GREETING_ID) return true
  if (message.english && HOME_GREETING_ENGLISH.test(message.english.trim())) return true
  const spoken = message.text.trim()
  return HOME_GREETING_SPOKEN_END.some((pattern) => pattern.test(spoken))
}

export const ADMIN_EMAIL = 'simonghooper@gmail.com'

export function isLanguageCode(value: string | null): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((item) => item.code === value)
}

export function getLanguage(code: LanguageCode): LanguageOption {
  const language = SUPPORTED_LANGUAGES.find((item) => item.code === code)
  if (!language) {
    throw new Error(`Unsupported language: ${code}`)
  }
  return language
}
