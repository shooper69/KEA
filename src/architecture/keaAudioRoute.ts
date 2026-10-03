import { speechRecognitionPings } from './keaWakeWord'
import { isKeaNativeApp } from '../lib/keaNative'

const ROUTE_KEY = 'kea-audio-route-v1'
const PROMPT_KEY = 'kea-audio-route-prompt'
/** Set after the user picks a route this browser/PWA session. */
const SESSION_DONE_KEY = 'kea-audio-route-session-done'

/** How Kea should prefer the mic, based on what the phone reports. */
export type KeaAudioRoute = 'speaker' | 'headphones' | 'bluetooth'

export type KeaAudioDeviceRole = 'bluetooth' | 'headset' | 'builtin' | 'other'

export interface KeaAudioDeviceSnapshot {
  kind: 'input' | 'output'
  deviceId: string
  label: string
  role: KeaAudioDeviceRole
}

export interface KeaAudioEnvironment {
  route: KeaAudioRoute
  /** Short line for the UI, e.g. "Car Bluetooth · BMW…" */
  summary: string
  /** Longer note: what the phone listed. */
  detail: string
  bluetoothConnected: boolean
  devices: KeaAudioDeviceSnapshot[]
}

export function isKeaMobileDevice() {
  if (typeof window === 'undefined') return false
  if (isKeaNativeApp()) return true
  if (speechRecognitionPings()) return true
  try {
    const nav = navigator as Navigator & { standalone?: boolean }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(nav.standalone)
    if (standalone && navigator.maxTouchPoints > 0) return true
  } catch {
    // ignore
  }
  try {
    // Touch phones that fail the UA ping (some WebViews / PWAs).
    if (
      window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
      Math.min(window.screen.width, window.screen.height) < 920
    ) {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

export function readAudioRoute(): KeaAudioRoute | null {
  try {
    const value = localStorage.getItem(ROUTE_KEY)
    if (value === 'speaker' || value === 'headphones' || value === 'bluetooth') {
      return value
    }
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

/** Mark that the next conversation open should show the audio check (after login only). */
export function markAudioRoutePromptPending() {
  try {
    sessionStorage.setItem(PROMPT_KEY, '1')
  } catch {
    // ignore
  }
}

/** True once after login — removes the flag so mid-session chat visits skip it. */
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

/** Call when the user finishes the speaker / headphones / Bluetooth check. */
export function markAudioRouteSessionDone() {
  try {
    sessionStorage.setItem(SESSION_DONE_KEY, '1')
  } catch {
    // ignore
  }
  clearAudioRoutePromptPending()
}

/**
 * True on mobile until the user finishes the speaker / headphones / Bluetooth
 * check once this tab/PWA session.
 */
export function shouldPromptAudioRouteOnce(): boolean {
  if (!isKeaMobileDevice()) return false
  try {
    if (sessionStorage.getItem(SESSION_DONE_KEY) === '1') {
      // Still prompt if no route was ever saved (stale session flag).
      return readAudioRoute() == null
    }
  } catch {
    // ignore
  }
  return true
}

/**
 * Open the audio check before talk on mobile (including installed PWA).
 * Once per tab/PWA session after they choose; also after login flag.
 */
export function shouldOpenAudioRouteCheck(options?: {
  restartListen?: boolean
}) {
  if (options?.restartListen) return false
  if (!isKeaMobileDevice()) return false
  if (consumeAudioRoutePromptPending()) return true
  return shouldPromptAudioRouteOnce()
}

export function shouldOfferAudioRoutePrompt(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_KEY) === '1'
  } catch {
    return false
  }
}

const BLUETOOTH_AUDIO =
  /bluetooth|\bbt\b|hands.?free|hfp|a2dp|car.?kit|carkit|vehicle|auto.?kit|galaxy.?buds|pixel.?buds/i
const HEADSET_MIC =
  /headset|headphone|airpods|buds|ear.?bud|lightning|usb.?c.?audio|wired/i
const BUILTIN_MIC =
  /iphone|ipad|android|built.?in|internal|phone|speaker|earpiece|microphone|default/i

export function looksLikeBluetoothAudio(label: string, deviceId = '') {
  return BLUETOOTH_AUDIO.test(`${label} ${deviceId}`)
}

export function looksLikeHeadsetMic(label: string, deviceId = '') {
  const name = `${label} ${deviceId}`
  if (looksLikeBluetoothAudio(label, deviceId)) return true
  return HEADSET_MIC.test(name)
}

export function classifyAudioDeviceRole(
  label: string,
  deviceId = '',
): KeaAudioDeviceRole {
  if (looksLikeBluetoothAudio(label, deviceId)) return 'bluetooth'
  if (HEADSET_MIC.test(`${label} ${deviceId}`)) return 'headset'
  if (BUILTIN_MIC.test(`${label} ${deviceId}`)) return 'builtin'
  return 'other'
}

function deviceDisplayName(label: string, role: KeaAudioDeviceRole) {
  const clean = label.replace(/\s+/g, ' ').trim()
  if (clean) return clean
  if (role === 'bluetooth') return 'Bluetooth audio'
  if (role === 'headset') return 'Headphones'
  if (role === 'builtin') return 'Phone microphone'
  return 'Audio device'
}

function summarizeEnvironment(
  route: KeaAudioRoute,
  devices: KeaAudioDeviceSnapshot[],
): Pick<KeaAudioEnvironment, 'summary' | 'detail' | 'bluetoothConnected'> {
  const bluetooth = devices.filter((item) => item.role === 'bluetooth')
  const headset = devices.filter((item) => item.role === 'headset')
  const namedBluetooth = bluetooth.find((item) => item.label.trim())
  const namedHeadset = headset.find((item) => item.label.trim())

  if (route === 'bluetooth') {
    const name = deviceDisplayName(
      namedBluetooth?.label || '',
      'bluetooth',
    )
    return {
      bluetoothConnected: true,
      summary: `Car / Bluetooth · ${name}`,
      detail:
        'Your phone lists a Bluetooth audio link (often the car). Kea will prefer that microphone.',
    }
  }
  if (route === 'headphones') {
    const name = deviceDisplayName(namedHeadset?.label || '', 'headset')
    return {
      bluetoothConnected: false,
      summary: `Headphones · ${name}`,
      detail: 'Your phone lists a headset or earbud mic. Kea will prefer that input.',
    }
  }
  return {
    bluetoothConnected: false,
    summary: 'Phone speaker',
    detail:
      'No Bluetooth or headset audio showed up. Kea will use the phone microphone.',
  }
}

async function unlockDeviceLabels() {
  if (!navigator.mediaDevices?.getUserMedia) return
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
    probe.getTracks().forEach((track) => track.stop())
  } catch {
    // Labels may stay blank without permission; still classify what we can.
  }
}

/**
 * Read what the phone currently exposes for talk audio (inputs + outputs).
 * Browsers cannot read the status-bar Bluetooth icon directly; they can list
 * media devices the OS has handed to the page — including car Bluetooth.
 */
export async function probeAudioEnvironment(): Promise<KeaAudioEnvironment> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return {
      route: 'speaker',
      summary: 'Phone speaker',
      detail: 'This browser cannot list audio devices.',
      bluetoothConnected: false,
      devices: [],
    }
  }

  let listed = await navigator.mediaDevices.enumerateDevices()
  const needsUnlock = listed.some(
    (item) =>
      (item.kind === 'audioinput' || item.kind === 'audiooutput') &&
      !item.label.trim(),
  )
  if (needsUnlock) {
    await unlockDeviceLabels()
    listed = await navigator.mediaDevices.enumerateDevices()
  }

  const devices: KeaAudioDeviceSnapshot[] = listed
    .filter((item) => item.kind === 'audioinput' || item.kind === 'audiooutput')
    .map((item) => {
      const role = classifyAudioDeviceRole(item.label, item.deviceId)
      return {
        kind: item.kind === 'audiooutput' ? 'output' : 'input',
        deviceId: item.deviceId,
        label: item.label.trim(),
        role,
      }
    })

  const hasBluetooth = devices.some((item) => item.role === 'bluetooth')
  const hasHeadset = devices.some((item) => item.role === 'headset')
  const route: KeaAudioRoute = hasBluetooth
    ? 'bluetooth'
    : hasHeadset
      ? 'headphones'
      : 'speaker'

  return {
    route,
    devices,
    ...summarizeEnvironment(route, devices),
  }
}

/** Human label for a stored route preference. */
export function audioRouteLabel(route: KeaAudioRoute | null): string {
  if (route === 'bluetooth') return 'Car / Bluetooth'
  if (route === 'headphones') return 'Headphones'
  if (route === 'speaker') return 'Phone speaker'
  return 'Not set yet'
}

/** Score boost for the chosen audio route when ranking mics. */
export function audioRouteMicBoost(label: string, deviceId: string): number {
  const route = readAudioRoute()
  if (!route) return 0
  const name = `${label} ${deviceId}`
  const bluetooth = BLUETOOTH_AUDIO.test(name)
  const headset = HEADSET_MIC.test(name) || bluetooth
  const builtin = BUILTIN_MIC.test(name) && !headset

  if (route === 'bluetooth') {
    if (bluetooth) return 100
    if (headset) return 40
    if (builtin) return -30
    return 0
  }
  if (route === 'headphones') {
    if (headset) return 80
    if (builtin) return -25
    return 0
  }
  if (headset) return -60
  if (builtin) return 35
  return 0
}
