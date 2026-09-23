import {
  createHomeGreetingMessage,
  isHomeGreetingMessage,
} from '../config/languages'
import type { LanguageCode, TranscriptMessage } from '../types'
import { looksLikeSystemText } from './whisperText'

const TALK_KEY = 'kea-talk-transcript-v1'
const MAX_SAVED = 400

function isMessage(value: unknown): value is TranscriptMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as TranscriptMessage
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    (item.speaker === 'user' || item.speaker === 'kea')
  )
}

/** Put the home greeting first. Empty talk gets only this row; history is prepended unless the first row is already that greeting. */
export function withHomeGreeting(
  messages: TranscriptMessage[],
  languageCode: LanguageCode,
  firstName: string,
): TranscriptMessage[] {
  const greeting = createHomeGreetingMessage(languageCode, firstName)
  if (messages.length === 0) return [greeting]
  const first = messages[0]
  if (isHomeGreetingMessage(first)) {
    if (first.text === greeting.text && first.english === greeting.english) {
      return messages
    }
    return [greeting, ...messages.slice(1)]
  }
  return [greeting, ...messages]
}

export function loadTalkTranscript(): TranscriptMessage[] {
  try {
    const raw = localStorage.getItem(TALK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return keepHomeGreeting(
      parsed
        .filter(isMessage)
        .filter((item) => item.text.trim() && !item.interim)
        .filter((item) => !looksLikeSystemText(item.text)),
    ).map((item) => ({
        ...item,
        interim: false,
        pending: false,
        active: false,
      }))
  } catch {
    return []
  }
}

function keepHomeGreeting(messages: TranscriptMessage[]): TranscriptMessage[] {
  const first = messages[0]
  if (messages.length <= MAX_SAVED) return messages
  if (!isHomeGreetingMessage(first)) return messages.slice(-MAX_SAVED)
  return [first, ...messages.slice(1).slice(-(MAX_SAVED - 1))]
}

export function saveTalkTranscript(messages: TranscriptMessage[]) {
  try {
    const compact = keepHomeGreeting(
      messages
        .filter((item) => item.text.trim() && !item.interim)
        .filter((item) => !looksLikeSystemText(item.text)),
    ).map((item) => ({
        id: item.id,
        speaker: item.speaker,
        text: item.text,
        english: item.english,
      }))
    if (compact.length === 0) {
      localStorage.removeItem(TALK_KEY)
      return
    }
    localStorage.setItem(TALK_KEY, JSON.stringify(compact))
  } catch {
    // ignore quota / private mode
  }
}

export const TALK_CLEARED_EVENT = 'kea-talk-cleared'

export function clearTalkTranscript() {
  try {
    localStorage.removeItem(TALK_KEY)
  } catch {
    // ignore
  }
}

/** Wipe stored talk and tell a mounted conversation hook to reset. */
export function requestClearTalkTranscript() {
  clearTalkTranscript()
  window.dispatchEvent(new Event(TALK_CLEARED_EVENT))
}
