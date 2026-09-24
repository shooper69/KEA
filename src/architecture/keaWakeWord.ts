function normalizeHeard(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const KEA_NAME = '(kea|kia|kiah|keya|kee+a|kier|kaya|kiya)'

export function heardKeaWake(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false
  // Whole short utterance is basically the wake phrase
  if (
    /^(yo|yoh|ya|yah|you|hey|hi|ok|okay|hola|oye|oi|oh|ja|yao)?\s*(kea|kia|kiah|keya|kee+a|kier|kaya|kiya|key)\s*[.!]*$/.test(
      n,
    )
  ) {
    return true
  }
  // One-token mishearings of "Yo Kea"
  if (
    /\b(yokea|yokeya|yokia|yokiah|yokaya|yakeya|yakea|yoga|yoki|yokee|yokey|okeya|okea|yokay|yorkie|ukulele)\b/.test(
      n,
    )
  ) {
    return true
  }
  // Split mishears: "yo key", "you kea", "joke a", "yoke a"
  if (/\b(yo|yoh|ya|you|joke|yoke|ok|okay)\s+(kea|kia|keya|key|kier|kaya|a)\b/.test(n)) {
    return true
  }
  if (
    new RegExp(
      `\\b(yo|yoh|ya|yah|you|to|too|two|hey|hi|ok|okay|hola|oye|oi|oh)\\s*${KEA_NAME}\\b`,
    ).test(n)
  ) {
    return true
  }
  if (new RegExp(`\\b(wake|call)\\s+${KEA_NAME}\\b`).test(n)) return true
  // Lone "kea" / "kia" only when that is essentially the whole phrase
  if (/^(kea|kia|kiah|keya|kaya|kiya)$/.test(n)) return true
  // Compact glued forms: "yokea", "yokiaa"
  const compact = n.replace(/\s+/g, '')
  if (compact.length <= 18 && /yo+k[eia]|ok+e[ea]|heykea|wakekea/.test(compact)) {
    return true
  }
  return false
}

export function heardKeaStop(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false
  return new RegExp(`\\b(stop|quit|end)\\s+${KEA_NAME}\\b`).test(n)
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
