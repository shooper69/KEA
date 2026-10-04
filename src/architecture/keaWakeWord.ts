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
 * Wake match for "Hey Kea", including when a request follows
 * ("Hey Kea, what's on my list"). A one-word "Kea" also counts.
 */
export function heardKeaWake(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false

  const words = n.split(/\s+/).filter(Boolean)
  const tail = words.slice(-12).join(' ')
  if (!tail) return false

  // Lone name (short utterance).
  if (/^(kea|kia|kiah|keya|ke+a|okaya|ok\s*kea)$/.test(tail)) return true

  if (new RegExp(`\\b${HEY_TOKEN}\\s+(there\\s+)?${KEA_TOKEN}\\b`).test(tail)) {
    return true
  }
  // "Okay Kea", "Alright Kea", "Kea listen"
  if (
    new RegExp(
      `\\b(ok|okay|alright|ready)\\s+${KEA_TOKEN}\\b`,
    ).test(tail)
  ) {
    return true
  }
  if (new RegExp(`\\b${KEA_TOKEN}\\s+(listen|wake|start|talk)\\b`).test(tail)) {
    return true
  }

  const compact = tail.replace(/\s+/g, '')
  if (
    compact.length <= 32 &&
    /(hey|hay|hei|hi|yo|ok|okay)+k(ea|ia|iah|eya|ee+a|ey)/.test(compact)
  ) {
    return true
  }

  return false
}

export function heardKeaStop(text: string) {
  const n = normalizeHeard(text)
  if (!n) return false
  if (new RegExp(`\\b(stop|quit|end|pause)\\s+${KEA_TOKEN}\\b`).test(n)) {
    return true
  }
  // Soft variants: "stop listening Kea", "Kea stop", "stop words Kea"
  if (
    new RegExp(
      `\\b(stop|quit|end|pause)\\s+(listening|talking|words|please|now)?\\s*${KEA_TOKEN}\\b`,
    ).test(n)
  ) {
    return true
  }
  if (new RegExp(`\\b${KEA_TOKEN}\\s+(stop|quit|end|pause|enough)\\b`).test(n)) {
    return true
  }
  // Short alone when the whole utterance is just stop / quit talking.
  if (/^(stop|quit|end|pause|enough)(\s+(please|now))?$/.test(n)) {
    return true
  }
  if (/^(stop|quit|pause)\s+(listening|talking|please|now)$/.test(n)) {
    return true
  }
  if (/^(that('|’)s|thats)\s+enough$/.test(n)) {
    return true
  }
  // Compact / slurred phone ASR: "stopkea", "stoplisten"
  const compact = n.replace(/\s+/g, '')
  if (
    /^(stop|quit|end|pause)(kea|kia|kiah|keya|kee+a|key)$/.test(compact) ||
    /^(kea|kia|kiah|keya|kee+a|key)(stop|quit|end|pause)$/.test(compact) ||
    /^(stop|quit)(listening|talking)$/.test(compact)
  ) {
    return true
  }
  return false
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

/**
 * One short SpeechRecognition pass (not continuous).
 * Used for mobile wake/stop so we avoid the continuous “ping” loop.
 */
export function oneShotSpeechRecognition(
  timeoutMs = 2400,
  match?: (text: string) => boolean,
): Promise<string> {
  const Ctor = getSpeechRecognition()
  if (!Ctor) return Promise.reject(new Error('no-speech-recognition'))
  return new Promise((resolve, reject) => {
    let settled = false
    let heard = ''
    let recognition: KeaSpeechRecognition | null = null
    const finish = (text: string, err?: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
      if (err && !text.trim()) reject(new Error(err))
      else resolve(text.trim())
    }
    const timer = window.setTimeout(() => finish(heard, 'timeout'), timeoutMs)
    try {
      const next = new Ctor()
      recognition = next
      next.lang = 'en-US'
      next.continuous = false
      next.interimResults = true
      next.maxAlternatives = 4
      next.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i]
          const count = Math.max(1, piece.length ?? 1)
          for (let a = 0; a < count; a++) {
            const said = piece?.[a]?.transcript ?? ''
            if (!said) continue
            heard = `${heard} ${said}`.replace(/\s+/g, ' ').trim()
            if (match?.(said) || match?.(heard)) {
              finish(said || heard)
              return
            }
          }
        }
      }
      next.onerror = (event) => {
        finish(heard, event.error || 'speech-error')
      }
      next.onend = () => {
        finish(heard)
      }
      next.start()
    } catch (caught) {
      finish('', caught instanceof Error ? caught.message : 'speech-start-failed')
    }
  })
}
