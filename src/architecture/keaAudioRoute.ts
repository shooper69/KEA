import { speechRecognitionPings } from './keaWakeWord'

const ROUTE_KEY = 'kea-audio-route-v1'
const PROMPT_KEY = 'kea-audio-route-prompt'

export type KeaAudioRoute = 'speaker' | 'headphones'

export function isKeaMobileDevice() {
  return speechRecognitionPings()
}

export function readAudioRoute(): KeaAudioRoute | null {
  try {
    const value = localStorage.getItem(ROUTE_KEY)
    if (value === 'speaker' || value === 'headphones') return value
  } catch {
    // ignore
  }
  return null
}

export function saveAudioRoute(route: KeaAudioRoute) {
  try {
    localStorage.setItem(ROUTE_KEY, route)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('kea-audio-route-changed'))
}

/** Mark that the next conversation open should ask (mobile login). */
export function markAudioRoutePromptPending() {
  try {
    sessionStorage.setItem(PROMPT_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumeAudioRoutePromptPending(): boolean {
  try {
    if (sessionStorage.getItem(PROMPT_KEY) !== '1') return false
    sessionStorage.removeItem(PROMPT_KEY)
    return true
  } catch {
    return false
  }
}

export function clearAudioRoutePromptPending() {
  try {
    sessionStorage.removeItem(PROMPT_KEY)
  } catch {
    // ignore
  }
}

export function shouldOfferAudioRoutePrompt(): boolean {
  if (!isKeaMobileDevice()) return false
  try {
    return sessionStorage.getItem(PROMPT_KEY) === '1'
  } catch {
    return false
  }
}

const HEADSET_MIC =
  /headset|headphone|airpods|bluetooth|buds|ear.?bud|hands.?free|lightning|usb.?c.?audio|wired/i
const BUILTIN_MIC =
  /iphone|ipad|android|built.?in|internal|phone|speaker|microphone/i

export function looksLikeHeadsetMic(label: string, deviceId = '') {
  return HEADSET_MIC.test(`${label} ${deviceId}`)
}

/** Score boost for the chosen audio route when ranking mics. */
export function audioRouteMicBoost(label: string, deviceId: string): number {
  const route = readAudioRoute()
  if (!route) return 0
  const name = `${label} ${deviceId}`
  if (route === 'headphones') {
    if (HEADSET_MIC.test(name)) return 80
    if (BUILTIN_MIC.test(name) && !HEADSET_MIC.test(name)) return -25
    return 0
  }
  if (HEADSET_MIC.test(name)) return -60
  if (BUILTIN_MIC.test(name)) return 35
  return 0
}
