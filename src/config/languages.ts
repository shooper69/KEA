import type { LanguageCode, LanguageOption } from '../types'

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español', speechLocale: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', speechLocale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', speechLocale: 'de-DE' },
]

export function getLanguage(code: LanguageCode): LanguageOption {
  const language = SUPPORTED_LANGUAGES.find((item) => item.code === code)
  if (!language) {
    throw new Error(`Unsupported language: ${code}`)
  }
  return language
}
