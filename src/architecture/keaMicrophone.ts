/** Prefer a real USB/built-in mic; skip Voicemod / EaseUS / virtual cables. */

const VIRTUAL_MIC =
  /voicemod|easeus|virtual|cable|stereo mix|what ?u ?hear|vb-?audio|voicewave|obs|discord/i

const PREFERRED_MIC =
  /samson|meteor|blue yeti|yeti|fifine|hyperx|logitech|headset|usb|realtek|array|intel|microphone/i

const PREFERRED_KEY = 'kea-preferred-mic-id'

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

export async function listAudioInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((item) => item.kind === 'audioinput')
}

async function unlockMicLabels() {
  if (!navigator.mediaDevices?.getUserMedia) return
  const probe = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  probe.getTracks().forEach((track) => track.stop())
}

function baseAudioConstraints(): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
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
    await unlockMicLabels()
  } catch {
    return null
  }
  const inputs = await listAudioInputs()
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

  let inputs: MediaDeviceInfo[] = []
  try {
    await unlockMicLabels()
    inputs = await listAudioInputs()
  } catch {
    inputs = []
  }

  const saved = readSavedMicId()
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
