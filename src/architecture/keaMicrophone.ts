import {
  audioRouteMicBoost,
  looksLikeHeadsetMic,
  probeAudioEnvironment,
  readAudioRoute,
  saveAudioRoute,
  type KeaAudioEnvironment,
  type KeaAudioRoute,
} from './keaAudioRoute'

/** Prefer a real USB/built-in mic; skip Voicemod / EaseUS / virtual cables. */

const VIRTUAL_MIC =
  /voicemod|easeus|virtual|cable|stereo mix|what ?u ?hear|vb-?audio|voicewave|obs|discord/i

const PREFERRED_MIC =
  /samson|meteor|blue yeti|yeti|fifine|hyperx|logitech|headset|usb|realtek|array|intel|microphone/i

const PREFERRED_KEY = 'kea-preferred-mic-id'
const PREFERRED_OUTPUT_KEY = 'kea-preferred-speaker-id'

export interface KeaMicInfo {
  deviceId: string
  label: string
  virtual: boolean
}

function isVirtualLabel(label: string, deviceId = '') {
  return VIRTUAL_MIC.test(label || deviceId)
}

function scoreMic(label: string, deviceId: string) {
  const name = label || deviceId
  if (isVirtualLabel(name, deviceId)) return -100
  let score = 0
  if (deviceId === 'default' || /default/i.test(name)) score += 12
  if (deviceId === 'communications') score += 6
  if (PREFERRED_MIC.test(name)) score += 40
  if (/samson|meteor/i.test(name)) score += 40
  score += audioRouteMicBoost(label, deviceId)
  return score
}

function readSavedMicId(): string {
  try {
    return localStorage.getItem(PREFERRED_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function savePreferredMicId(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(PREFERRED_KEY, deviceId)
    else localStorage.removeItem(PREFERRED_KEY)
  } catch {
    // ignore
  }
}

export function readPreferredOutputId(): string {
  try {
    return localStorage.getItem(PREFERRED_OUTPUT_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function savePreferredOutputId(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(PREFERRED_OUTPUT_KEY, deviceId)
    else localStorage.removeItem(PREFERRED_OUTPUT_KEY)
  } catch {
    // ignore
  }
}

/** Route HTMLAudioElement playback to the saved PC speaker when the browser allows it. */
export async function applyPreferredAudioOutput(audio: HTMLAudioElement) {
  // Only when the user picked "This computer" — never force a sink on marketing
  // welcome or phone routes (setSinkId can block autoplay after async work).
  if (readAudioRoute() !== 'pc') return
  const sinkId = readPreferredOutputId()
  if (!sinkId) return
  const el = audio as HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>
  }
  if (typeof el.setSinkId !== 'function') return
  try {
    await el.setSinkId(sinkId)
  } catch {
    // Browser or OS may refuse; keep default output.
  }
}

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((item) => item.kind === 'audioinput')
}

export async function listAudioOutputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((item) => item.kind === 'audiooutput')
}

async function unlockMicLabels() {
  if (!navigator.mediaDevices?.getUserMedia) return
  const probe = await navigator.mediaDevices.getUserMedia({
    audio: baseAudioConstraints(),
  })
  probe.getTracks().forEach((track) => track.stop())
}

async function ensureMicLabels() {
  const existing = await listAudioInputs()
  if (existing.some((item) => item.label.trim())) return existing
  try {
    await unlockMicLabels()
  } catch {
    return existing
  }
  return listAudioInputs()
}

function baseAudioConstraints(): MediaTrackConstraints {
  // Prefer browser noise fighting when available (Chromium voiceIsolation / goog*).
  const advanced: Record<string, boolean | number> = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  }
  // Chromium / Edge hints — ignored when unsupported.
  advanced.voiceIsolation = true
  advanced.googEchoCancellation = true
  advanced.googNoiseSuppression = true
  advanced.googNoiseSuppression2 = true
  advanced.googAutoGainControl = true
  advanced.googAutoGainControl2 = true
  advanced.googHighpassFilter = true
  advanced.googTypingNoiseDetection = true
  return advanced as MediaTrackConstraints
}

async function openWithConstraints(
  audio: MediaTrackConstraints,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio })
}

function infoFromStream(
  stream: MediaStream,
  fallbackId: string,
): KeaMicInfo {
  const track = stream.getAudioTracks()[0]
  const label = track?.label || 'Microphone'
  const deviceId =
    (track?.getSettings?.().deviceId as string | undefined) || fallbackId
  return {
    deviceId,
    label,
    virtual: isVirtualLabel(label, deviceId),
  }
}

/** Unlock device labels, then pick the best physical mic. */
export async function pickKeaMicrophone(): Promise<KeaMicInfo | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null
  try {
    const inputs = await ensureMicLabels()
    if (inputs.length === 0) return null
    const saved = readSavedMicId()
    const ranked = [...inputs].sort((a, b) => {
      const savedBoost = (id: string) => (saved && id === saved ? 1000 : 0)
      return (
        scoreMic(b.label, b.deviceId) +
        savedBoost(b.deviceId) -
        (scoreMic(a.label, a.deviceId) + savedBoost(a.deviceId))
      )
    })
    const best = ranked.find((item) => scoreMic(item.label, item.deviceId) >= 0)
    const chosen = best ?? ranked[0]
    if (!chosen) return null
    return {
      deviceId: chosen.deviceId,
      label: chosen.label || 'Microphone',
      virtual: isVirtualLabel(chosen.label, chosen.deviceId),
    }
  } catch {
    return null
  }
}

/**
 * Open a mic stream, preferring a saved / physical device.
 * Tries exact device ids so Chrome site defaults (Voicemod) do not win.
 */
export async function openKeaMicrophone(): Promise<{
  stream: MediaStream
  info: KeaMicInfo
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API unavailable')
  }

  const saved = readSavedMicId()
  if (saved) {
    try {
      const stream = await openWithConstraints({
        ...baseAudioConstraints(),
        deviceId: { exact: saved },
      })
      const info = infoFromStream(stream, saved)
      if (!info.virtual) return { stream, info }
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      // Fall through to full device scan.
    }
  }

  let inputs: MediaDeviceInfo[] = []
  try {
    inputs = await ensureMicLabels()
  } catch {
    inputs = []
  }

  const ranked = [...inputs].sort((a, b) => {
    const savedBoost = (id: string) => (saved && id === saved ? 1000 : 0)
    return (
      scoreMic(b.label, b.deviceId) +
      savedBoost(b.deviceId) -
      (scoreMic(a.label, a.deviceId) + savedBoost(a.deviceId))
    )
  })

  const candidates = ranked.filter(
    (item) =>
      item.deviceId &&
      item.deviceId !== 'default' &&
      item.deviceId !== 'communications' &&
      scoreMic(item.label, item.deviceId) >= 0,
  )

  for (const candidate of candidates) {
    try {
      const stream = await openWithConstraints({
        ...baseAudioConstraints(),
        deviceId: { exact: candidate.deviceId },
      })
      const info = infoFromStream(stream, candidate.deviceId)
      if (info.virtual) {
        stream.getTracks().forEach((track) => track.stop())
        continue
      }
      savePreferredMicId(info.deviceId)
      return { stream, info }
    } catch {
      // Try next physical device.
    }
  }

  // Last resort: browser default (may be the Windows default Samson).
  const stream = await openWithConstraints(baseAudioConstraints())
  const info = infoFromStream(stream, 'default')
  if (!info.virtual) savePreferredMicId(info.deviceId)
  return { stream, info }
}

/**
 * After the phone reports speaker / headphones / Bluetooth, lock in a matching
 * input when labels are available.
 */
export async function applyAudioRouteMic(route: KeaAudioRoute) {
  saveAudioRoute(route)
  if (route === 'pc') return
  try {
    const inputs = await ensureMicLabels()
    if (inputs.length === 0) return

    const ranked = [...inputs].sort((a, b) => {
      const score = (item: MediaDeviceInfo) =>
        scoreMic(item.label, item.deviceId) +
        (item.deviceId === 'default' ? 5 : 0)
      return score(b) - score(a)
    })

    if (route === 'headphones' || route === 'bluetooth') {
      const preferBluetooth = route === 'bluetooth'
      const match = ranked.find((item) => {
        if (preferBluetooth) {
          return (
            looksLikeHeadsetMic(item.label, item.deviceId) ||
            /bluetooth|\bbt\b|hands.?free|car.?kit/i.test(
              `${item.label} ${item.deviceId}`,
            )
          )
        }
        return looksLikeHeadsetMic(item.label, item.deviceId)
      })
      savePreferredMicId(match?.deviceId || '')
      return
    }

    const builtin = ranked.find(
      (item) =>
        !looksLikeHeadsetMic(item.label, item.deviceId) &&
        scoreMic(item.label, item.deviceId) >= 0,
    )
    savePreferredMicId(builtin?.deviceId || ranked[0]?.deviceId || '')
  } catch {
    // Route preference still saved; mic picker falls back later.
  }
}

/** Lock PC surface to a specific mic (and optional speaker) from the chooser. */
export async function applyPcAudioDevices(options: {
  inputDeviceId: string
  outputDeviceId?: string
}) {
  saveAudioRoute('pc')
  savePreferredMicId(options.inputDeviceId)
  savePreferredOutputId(options.outputDeviceId || '')
}

/** Probe the phone’s current audio devices and apply the matching mic. */
export async function syncAudioRouteFromPhone(): Promise<KeaAudioEnvironment> {
  const environment = await probeAudioEnvironment()
  await applyAudioRouteMic(environment.route)
  return environment
}
