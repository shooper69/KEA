import {
  createHomeGreetingMessage,
  isHomeGreetingMessage,
} from '../config/languages'
import type { LanguageCode, TranscriptMessage } from '../types'
import { withoutRejoinWelcomes } from './keaStartSpeech'
import { looksLikeSystemText } from './whisperText'
import { abandonSpokenTourEverywhere } from '../data/keaOnboarding'

const TALK_KEY = 'kea-talk-transcript-v1'
/**
 * What is on screen for this browser session (sessionStorage).
 * Kea's long-term memory stays in localStorage under TALK_KEY.
 * Never restore the screen from localStorage — that brought old chats back on login.
 */
const SCREEN_KEY = 'kea-talk-screen-v1'
/** Latch: next chat open (or a mounted hook) must show a blank screen + welcome only. */
const FRESH_SCREEN_KEY = 'kea-fresh-chat-screen'
/** Set after the first screen read this browser session. */
const SESSION_PRIMED_KEY = 'kea-chat-session-primed'
const MAX_SAVED = 400

/** In-memory latch so a late markFresh still wins over state that already loaded. */
let forceFreshScreen = false

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

function parseStoredMessages(raw: string | null): TranscriptMessage[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return withoutRejoinWelcomes(
      keepHomeGreeting(
        parsed
          .filter(isMessage)
          .filter((item) => item.text.trim() && !item.interim)
          .filter((item) => !looksLikeSystemText(item.text)),
      ),
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

function readLocalMessages(key: string): TranscriptMessage[] {
  try {
    return parseStoredMessages(localStorage.getItem(key))
  } catch {
    return []
  }
}

function readSessionMessages(key: string): TranscriptMessage[] {
  try {
    return parseStoredMessages(sessionStorage.getItem(key))
  } catch {
    return []
  }
}

function clearScreenStorage() {
  try {
    sessionStorage.removeItem(SCREEN_KEY)
  } catch {
    // ignore
  }
  try {
    // Drop the old cross-session screen copy so it cannot come back.
    localStorage.removeItem(SCREEN_KEY)
  } catch {
    // ignore
  }
}

export function loadTalkTranscript(): TranscriptMessage[] {
  return readLocalMessages(TALK_KEY)
}

/** Lines shown in the chat. Visit-scoped; never seeded from the archive. */
export function loadTalkScreen(): TranscriptMessage[] {
  try {
    // First chat read this browser session → blank screen + welcome only.
    if (sessionStorage.getItem(SESSION_PRIMED_KEY) !== '1') {
      sessionStorage.setItem(SESSION_PRIMED_KEY, '1')
      forceFreshScreen = false
      sessionStorage.removeItem(FRESH_SCREEN_KEY)
      clearScreenStorage()
      return []
    }
    if (
      forceFreshScreen ||
      sessionStorage.getItem(FRESH_SCREEN_KEY) === '1'
    ) {
      forceFreshScreen = false
      sessionStorage.removeItem(FRESH_SCREEN_KEY)
      clearScreenStorage()
      return []
    }
  } catch {
    // ignore
  }
  // Purge legacy localStorage screen without reading it.
  try {
    localStorage.removeItem(SCREEN_KEY)
  } catch {
    // ignore
  }
  return readSessionMessages(SCREEN_KEY)
}

/** True once when login (or reset) asked for a blank welcome screen. */
export function takeFreshChatScreen(): boolean {
  let flagged = forceFreshScreen
  forceFreshScreen = false
  try {
    if (sessionStorage.getItem(FRESH_SCREEN_KEY) === '1') {
      sessionStorage.removeItem(FRESH_SCREEN_KEY)
      flagged = true
    }
  } catch {
    // ignore
  }
  if (flagged) clearScreenStorage()
  return flagged
}

function keepHomeGreeting(messages: TranscriptMessage[]): TranscriptMessage[] {
  const first = messages[0]
  if (messages.length <= MAX_SAVED) return messages
  if (!isHomeGreetingMessage(first)) return messages.slice(-MAX_SAVED)
  return [first, ...messages.slice(1).slice(-(MAX_SAVED - 1))]
}

function compactMessages(messages: TranscriptMessage[]) {
  return keepHomeGreeting(
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
}

function writeLocalMessages(key: string, messages: TranscriptMessage[]) {
  try {
    const compact = compactMessages(messages)
    if (compact.length === 0) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(compact))
  } catch {
    // ignore quota / private mode
  }
}

function writeSessionMessages(key: string, messages: TranscriptMessage[]) {
  try {
    const compact = compactMessages(messages)
    if (compact.length === 0) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, JSON.stringify(compact))
  } catch {
    // ignore quota / private mode
  }
}

export function saveTalkTranscript(messages: TranscriptMessage[]) {
  writeLocalMessages(TALK_KEY, messages)
}

export function saveTalkScreen(messages: TranscriptMessage[]) {
  writeSessionMessages(SCREEN_KEY, messages)
  // Never re-seed the legacy localStorage screen key.
  try {
    localStorage.removeItem(SCREEN_KEY)
  } catch {
    // ignore
  }
}

/** Add new on-screen lines to Kea's memory without putting old lines back on screen. */
export function appendTalkArchive(messages: TranscriptMessage[]) {
  const prior = loadTalkTranscript()
  const seen = new Set(prior.map((item) => item.id))
  const extra = messages.filter((item) => item.id && !seen.has(item.id))
  if (extra.length === 0) return
  saveTalkTranscript([...prior, ...extra])
}

export const TALK_CLEARED_EVENT = 'kea-talk-cleared'
/** Screen only — archive stays so Kea can still recall prior chats. */
export const TALK_SCREEN_CLEARED_EVENT = 'kea-talk-screen-cleared'
const HOLD_GREETING_KEY = 'kea-hold-greeting'

/** Block a new welcome while a language change is being saved, then the page reloads. */
export function holdTalkForLanguageChange() {
  try {
    sessionStorage.setItem(HOLD_GREETING_KEY, '1')
  } catch {
    // ignore
  }
  requestClearTalkTranscript()
}

export function isTalkHeld() {
  try {
    return sessionStorage.getItem(HOLD_GREETING_KEY) === '1'
  } catch {
    return false
  }
}

export function clearTalkTranscript() {
  try {
    localStorage.removeItem(TALK_KEY)
  } catch {
    // ignore
  }
  clearScreenStorage()
  try {
    sessionStorage.removeItem(FRESH_SCREEN_KEY)
  } catch {
    // ignore
  }
  forceFreshScreen = false
}

/**
 * Next chat open (and any mounted conversation) must be blank except the welcome.
 * Keeps the archive for memory. Safe to call before navigate or on login.
 */
export function markFreshChatScreen() {
  forceFreshScreen = true
  try {
    sessionStorage.setItem(FRESH_SCREEN_KEY, '1')
  } catch {
    // ignore
  }
  clearScreenStorage()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TALK_SCREEN_CLEARED_EVENT))
  }
}

/** Wipe stored talk and tell a mounted conversation hook to reset. */
export function requestClearTalkTranscript() {
  clearTalkTranscript()
  window.dispatchEvent(new Event(TALK_CLEARED_EVENT))
}

/** Full document load. A same-URL assign does not reload, so a frozen Kea stayed frozen. */
export function keaRestartUrl() {
  const url = new URL('/conversation', window.location.origin)
  url.searchParams.set('restart', String(Date.now()))
  return url.toString()
}

const RESTART_LISTEN_KEY = 'kea-restart-listen'
let restartListenLatched: boolean | null = null

/**
 * True on the conversation page that opens right after Reset.
 * Stays stable if React mounts the page twice, then goes false once that page leaves.
 */
export function peekRestartListen(): boolean {
  if (restartListenLatched === null) {
    try {
      restartListenLatched = sessionStorage.getItem(RESTART_LISTEN_KEY) === '1'
      if (restartListenLatched) sessionStorage.removeItem(RESTART_LISTEN_KEY)
    } catch {
      restartListenLatched = false
    }
  }
  return restartListenLatched
}

export function releaseRestartListen() {
  restartListenLatched = false
}

/**
 * Clear the chat and reload Kea without signing out.
 * The new URL forces a real navigation so stuck mic, speech, and paint state cannot linger.
 */
export function requestClearTalkAndSoftReset() {
  try {
    sessionStorage.removeItem(HOLD_GREETING_KEY)
  } catch {
    // ignore
  }
  abandonSpokenTourEverywhere()
  // Wipe talk, blank the live UI, then mark the next open as a fresh welcome.
  requestClearTalkTranscript()
  markFreshChatScreen()
  try {
    sessionStorage.setItem(RESTART_LISTEN_KEY, '1')
    window.speechSynthesis?.cancel()
  } catch {
    // ignore
  }
  const url = keaRestartUrl()
  // Must stay inside the user gesture on mobile/PWA — do not defer.
  // Prefer href: some Android WebViews ignore assign after a confirm dialog.
  try {
    window.location.href = url
  } catch {
    try {
      window.location.assign(url)
    } catch {
      window.location.reload()
    }
  }
  // If the service worker soft-routes and never leaves, force a real reload.
  window.setTimeout(() => {
    try {
      if (!window.location.search.includes('restart=')) {
        window.location.reload()
      }
    } catch {
      // ignore
    }
  }, 500)
}
