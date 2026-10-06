import { getLanguage } from '../config/languages'
import type { LanguageCode } from '../types'

/**
 * Marketing lines Kea speaks in first person (English source).
 * Shown on the welcome page as she speaks them.
 */
export const WELCOME_CLOSING_LINE_EN = "I'd love to get to know you."

/** Extra gpt-4o-mini-tts direction for the closing invitation. */
export const WELCOME_CLOSING_TTS_HINT =
  'Emphasize the word "love" (or the equivalent affection word if translated) with warm sincerity — linger on it slightly so it feels heartfelt.'

/** Index of the “anything-goes” line — the welcome starts this one with less pause. */
export const WELCOME_ANYTHING_INDEX = 3

export const WELCOME_FIRST_PERSON_EN = [
  "I'm a language learning chatty companion. I help you learn languages naturally through real conversation, remembered topics, and a personalised Learn List.",
  'I behave like a friend, not a teacher. As you chat, you impact my personality, and change my mood, just as you do with a friend.',
  "I'm there for you whenever you've got a few spare minutes; in your car, walking the dog, doing the dishes.",
  'Just an anything-goes hands-free chatty companion, speaking in the languages of your choice and helping you when you make mistakes.',
  WELCOME_CLOSING_LINE_EN,
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
