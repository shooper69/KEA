function normalizeHeard(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clear forms of the bird's name — avoid common words like kaya alone. */
const KEA_TOKEN = '(kea|kia|kiah|keya|kee+a|key)'

/** Attentional opener — primary wake is "Hey Kea". */
const HEY_TOKEN = '(hey|hay|hei|hi|yo|yoh|yah)'

/**
 * Wake match for "Hey Kea" (and close variants).
 * Lone "Kea" is intentionally not enough — too many Whisper false misses/hits.
 */
export function heardKeaWake(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false

  // Wake phrases are short. Long noise transcripts must not match.
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length > 6) return false

  // Exact: "Hey Kea", "Hi Kea", "Yo Kea"
  if (new RegExp(`^${HEY_TOKEN}\\s+${KEA_TOKEN}$`).test(n)) {
    return true
  }

  // Soft fluff: "um hey kea", "hey there kea", "okay hey kea"
  if (
    new RegExp(
      `^(um+|uh+|oh+|ok|okay|well)?\\s*${HEY_TOKEN}\\s+(there\\s+)?${KEA_TOKEN}$`,
    ).test(n)
  ) {
    return true
  }

  // Compact glued forms (heykea / heykeya / heykey)
  const compact = n.replace(/\s+/g, '')
  if (
    compact.length <= 14 &&
    /^(um|uh|ok|okay)?(hey|hay|hei|hi|yo)+k(ea|ia|iah|eya|ee+a|ey)$/.test(
      compact,
    )
  ) {
    return true
  }

  return false
}

export function heardKeaStop(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false
  return new RegExp(`\\b(stop|quit|end)\\s+${KEA_TOKEN}\\b`).test(n)
}

export interface KeaSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<ArrayLike<{ transcript?: string }>>
  }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export function getSpeechRecognition(): (new () => KeaSpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => KeaSpeechRecognition
    webkitSpeechRecognition?: new () => KeaSpeechRecognition
  }
  return (
    speechWindow.SpeechRecognition ||
    speechWindow.webkitSpeechRecognition ||
    null
  )
}

/** Phones ping every time the browser speech engine starts. */
export function speechRecognitionPings(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const touchMac =
    platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(ua)
  // Chrome DevTools device mode spoofs a phone UA on a desktop platform.
  // That must NOT use the mobile wake path (SpeechRecognition fails there).
  const desktopPlatform =
    /Win32|Win64|MacIntel|Linux x86_64|Linux x86-64/i.test(platform) &&
    !touchMac
  if (mobileUa && desktopPlatform) return false
  return mobileUa || touchMac
}

/** Kept for hot-reload compatibility; desktop wake restart delay. */
export function wakeRestartMs(): number {
  return speechRecognitionPings() ? 1800 : 280
}

export function speechRecognitionAvailable(): boolean {
  return Boolean(getSpeechRecognition())
}
