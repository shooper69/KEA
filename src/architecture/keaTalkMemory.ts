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

/** Put the home greeting first when there is history. Empty talk stays empty (clear chat, fresh visit). */
export function withHomeGreeting(
  messages: TranscriptMessage[],
  languageCode: LanguageCode,
  firstName: string,
): TranscriptMessage[] {
  if (messages.length === 0) return []
  const greeting = createHomeGreetingMessage(languageCode, firstName)
  const existingIndex = messages.findIndex(isHomeGreetingMessage)
  if (existingIndex === 0) {
    const first = messages[0]
    if (first.text === greeting.text && first.english === greeting.english) {
      return messages
    }
    return [greeting, ...messages.slice(1)]
  }
  if (existingIndex > 0) {
    const rest = messages.filter((_, index) => index !== existingIndex)
    return [greeting, ...rest]
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
        highlights: Array.isArray(item.highlights)
          ? item.highlights.filter((h): h is string => typeof h === 'string')
          : undefined,
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
        highlights: item.highlights?.length ? item.highlights : undefined,
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

/**
 * Clear the chat and soft-reset runtime (mic, speech, AudioContext) without signing out.
 * Full navigation remounts the app so stuck mobile listeners cannot linger.
 */
export function requestClearTalkAndSoftReset() {
  clearTalkTranscript()
  try {
    window.speechSynthesis?.cancel()
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(TALK_CLEARED_EVENT))
  const next = `${window.location.origin}/conversation`
  window.setTimeout(() => {
    window.location.assign(next)
  }, 0)
}
