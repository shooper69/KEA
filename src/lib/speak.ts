import { getLanguage } from '../config/languages'
import type { LanguageCode } from '../types'

export function speakInLanguage(text: string, languageCode: LanguageCode) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = getLanguage(languageCode).speechLocale
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
}
