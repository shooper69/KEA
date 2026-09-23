function normalizeHeard(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const KEA_NAME = '(kea|kia|kiah|keya|kee+a|kier)'

export function heardKeaWake(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false
  if (new RegExp(`\\b(yo|yoh|ya|you|to|too|two|hey|hi|ok|okay|hola)\\s*${KEA_NAME}\\b`).test(n)) {
    return true
  }
  if (new RegExp(`\\b(wake|call)\\s+${KEA_NAME}\\b`).test(n)) return true
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
