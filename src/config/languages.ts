import type { LanguageCode, LanguageOption, TranscriptMessage } from '../types'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechLocale: 'en-GB' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechLocale: 'es-ES' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', speechLocale: 'pt-PT' },
  { code: 'fr', name: 'French', nativeName: 'Français', speechLocale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechLocale: 'de-DE' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', speechLocale: 'nl-NL' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', speechLocale: 'it-IT' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', speechLocale: 'pl-PL' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', speechLocale: 'bg-BG' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', speechLocale: 'ru-RU' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', speechLocale: 'uk-UA' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', speechLocale: 'cs-CZ' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', speechLocale: 'sk-SK' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', speechLocale: 'ro-RO' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', speechLocale: 'hu-HU' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', speechLocale: 'hr-HR' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', speechLocale: 'sr-RS' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', speechLocale: 'sv-SE' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', speechLocale: 'da-DK' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', speechLocale: 'nb-NO' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', speechLocale: 'fi-FI' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', speechLocale: 'el-GR' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', speechLocale: 'tr-TR' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', speechLocale: 'ca-ES' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', speechLocale: 'ar-SA' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', speechLocale: 'he-IL' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechLocale: 'hi-IN' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', speechLocale: 'zh-CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', speechLocale: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', speechLocale: 'ko-KR' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', speechLocale: 'th-TH' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', speechLocale: 'vi-VN' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', speechLocale: 'id-ID' },
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
    name ? `Olá ${name}, como estás hoje?` : 'Olá, como estás hoje?',
  nl: (name) =>
    name ? `Hoi ${name}, hoe gaat het vandaag?` : 'Hoi, hoe gaat het vandaag?',
  pl: (name) =>
    name ? `Cześć ${name}, jak się dziś masz?` : 'Cześć, jak się dziś masz?',
  bg: (name) =>
    name ? `Здравей, ${name}, как си днес?` : 'Здравей, как си днес?',
  uk: (name) =>
    name ? `Привіт, ${name}, як справи сьогодні?` : 'Привіт, як справи сьогодні?',
  sv: (name) =>
    name ? `Hej ${name}, hur mår du idag?` : 'Hej, hur mår du idag?',
  da: (name) =>
    name ? `Hej ${name}, hvordan har du det i dag?` : 'Hej, hvordan har du det i dag?',
  no: (name) =>
    name ? `Hei ${name}, hvordan går det i dag?` : 'Hei, hvordan går det i dag?',
  fi: (name) =>
    name ? `Hei ${name}, mitä kuuluu tänään?` : 'Hei, mitä kuuluu tänään?',
  cs: (name) =>
    name ? `Ahoj ${name}, jak se dnes máš?` : 'Ahoj, jak se dnes máš?',
  sk: (name) =>
    name ? `Ahoj ${name}, ako sa máš dnes?` : 'Ahoj, ako sa máš dnes?',
  ro: (name) =>
    name ? `Salut ${name}, ce mai faci azi?` : 'Salut, ce mai faci azi?',
  hu: (name) =>
    name ? `Szia ${name}, hogy vagy ma?` : 'Szia, hogy vagy ma?',
  hr: (name) =>
    name ? `Bok ${name}, kako si danas?` : 'Bok, kako si danas?',
  sr: (name) =>
    name ? `Здраво ${name}, како си данас?` : 'Здраво, како си данас?',
  el: (name) =>
    name ? `Γεια σου ${name}, πώς είσαι σήμερα;` : 'Γεια σου, πώς είσαι σήμερα;',
  tr: (name) =>
    name ? `Merhaba ${name}, bugün nasılsın?` : 'Merhaba, bugün nasılsın?',
  ca: (name) =>
    name ? `Hola ${name}, com estàs avui?` : 'Hola, com estàs avui?',
  ar: (name) =>
    name ? `مرحباً ${name}، كيف حالك اليوم؟` : 'مرحباً، كيف حالك اليوم؟',
  he: (name) =>
    name ? `שלום ${name}, מה שלומך היום?` : 'שלום, מה שלומך היום?',
  hi: (name) =>
    name ? `नमस्ते ${name}, आज आप कैसे हैं?` : 'नमस्ते, आज आप कैसे हैं?',
  zh: (name) =>
    name ? `${name}，你好，今天怎么样？` : '你好，今天怎么样？',
  ja: (name) =>
    name ? `${name}さん、こんにちは。元気ですか？` : 'こんにちは。元気ですか？',
  ko: (name) =>
    name ? `${name} 님, 안녕하세요. 오늘 어떠세요?` : '안녕하세요. 오늘 어떠세요?',
  th: (name) =>
    name ? `สวัสดี ${name} วันนี้เป็นอย่างไรบ้าง` : 'สวัสดี วันนี้เป็นอย่างไรบ้าง',
  vi: (name) =>
    name ? `Chào ${name}, hôm nay bạn thế nào?` : 'Chào bạn, hôm nay bạn thế nào?',
  id: (name) =>
    name ? `Hai ${name}, apa kabar hari ini?` : 'Hai, apa kabar hari ini?',
}

export function spokenHomeGreeting(languageCode: string, firstName: string): string {
  const name = greetingFirstName(firstName)
  const make = HOME_GREETING_SPOKEN[languageCode] ?? HOME_GREETING_SPOKEN.en
  return make(name)
}

/** Short reply when the user taps Kea or says the wake word — always in the learning language. */
const WAKE_ACK_SPOKEN: Record<string, string> = {
  en: "Yes, I'm here",
  es: 'Sí, estoy aquí',
  fr: 'Oui, je suis là',
  de: 'Ja, ich bin da',
  ru: 'Да, я здесь',
  it: 'Sì, sono qui',
  pt: 'Sim, estou aqui',
  nl: 'Ja, ik ben hier',
  pl: 'Tak, jestem tutaj',
  bg: 'Да, тук съм',
  uk: 'Так, я тут',
  sv: 'Ja, jag är här',
  da: 'Ja, jeg er her',
  no: 'Ja, jeg er her',
  fi: 'Kyllä, olen täällä',
  cs: 'Ano, jsem tady',
  sk: 'Áno, som tu',
  ro: 'Da, sunt aici',
  hu: 'Igen, itt vagyok',
  hr: 'Da, tu sam',
  sr: 'Да, ту сам',
  el: 'Ναι, είμαι εδώ',
  tr: 'Evet, buradayım',
  ca: 'Sí, sóc aquí',
  ar: 'نعم، أنا هنا',
  he: 'כן, אני כאן',
  hi: 'हाँ, मैं यहाँ हूँ',
  zh: '是的，我在',
  ja: 'はい、ここにいます',
  ko: '네, 여기 있어요',
  th: 'ใช่ ฉันอยู่ที่นี่',
  vi: 'Vâng, tôi đây',
  id: 'Ya, saya di sini',
}

const WAKE_ACK_ENGLISH = "Yes, I'm here"

export function spokenWakeAck(languageCode: string): string {
  return WAKE_ACK_SPOKEN[languageCode] ?? WAKE_ACK_SPOKEN.en
}

export function wakeAckEnglishCaption(languageCode: string): string | undefined {
  return languageCode === 'en' ? undefined : WAKE_ACK_ENGLISH
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
  /como (você )?estás hoje\?$/i,
  /hoe gaat het vandaag\?$/i,
  /jak się dziś masz\?$/i,
  /как си днес\?$/i,
  /how are you today\?$/i,
]

export function isHomeGreetingMessage(message: TranscriptMessage | undefined): boolean {
  if (!message || message.speaker !== 'kea') return false
  if (message.id === HOME_GREETING_ID) return true
  if (message.english && HOME_GREETING_ENGLISH.test(message.english.trim())) return true
  const spoken = message.text.trim()
  return HOME_GREETING_SPOKEN_END.some((pattern) => pattern.test(spoken))
}

export { KEA_ADMIN_EMAIL as ADMIN_EMAIL } from './keaAdmin.ts'

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
