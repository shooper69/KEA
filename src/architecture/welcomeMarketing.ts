import { getLanguage } from '../config/languages'
import type { LanguageCode } from '../types'

/**
 * Marketing lines Kea speaks in first person (English source).
 * Shown on the welcome page as she speaks them.
 */
export const WELCOME_FIRST_PERSON_EN = [
  "I'm a hands-free conversational companion that helps you learn languages naturally through real conversation, remembered topics, and a personalised Learn List.",
  'I behave like a friend, not a teacher. As you chat, you impact my personality, and change my mood, just as you do with a friend.',
  "I'm there for you whenever you've got a few spare minutes; in your car, walking the dog, doing the dishes.",
  'Just an anything-goes chatty companion, speaking in the languages of your choice and helping you when you make mistakes.',
] as const

export async function welcomeScriptForLanguage(
  languageCode: LanguageCode,
): Promise<string[]> {
  if (languageCode === 'en') {
    return [...WELCOME_FIRST_PERSON_EN]
  }

  const language = getLanguage(languageCode)
  const paragraphs: string[] = []

  for (const paragraph of WELCOME_FIRST_PERSON_EN) {
    const translated = await translateParagraph(paragraph, language.name)
    paragraphs.push(translated || paragraph)
  }

  return paragraphs
}

async function translateParagraph(
  text: string,
  targetLanguageName: string,
): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'plain-translate',
        targetLanguage: targetLanguageName,
        text,
      }),
    })
    if (!response.ok) return text
    const data = (await response.json()) as {
      translation?: string
      reply?: string
    }
    return (data.translation || data.reply || text).trim() || text
  } catch {
    return text
  }
}
