import type { LanguageCode, LanguageOption } from '../types'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechLocale: 'en-GB' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechLocale: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', speechLocale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechLocale: 'de-DE' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', speechLocale: 'ru-RU' },
]

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
