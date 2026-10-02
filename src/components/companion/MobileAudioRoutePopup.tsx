import { useEffect, useState } from 'react'
import {
  markAudioRouteSessionDone,
  probeAudioEnvironment,
  readAudioRoute,
  type KeaAudioEnvironment,
  type KeaAudioRoute,
} from '../../architecture/keaAudioRoute'
import { applyAudioRouteMic } from '../../architecture/keaMicrophone'

interface MobileAudioRoutePopupProps {
  onDone: () => void
}

/**
 * After the first speak request on mobile: let the user pick phone speaker,
 * headphones, or Bluetooth/car so Kea uses the matching microphone.
 */
export function MobileAudioRoutePopup({ onDone }: MobileAudioRoutePopupProps) {
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(true)
  const [environment, setEnvironment] = useState<KeaAudioEnvironment | null>(
    null,
  )
  const current = readAudioRoute()

  useEffect(() => {
    let cancelled = false
    void probeAudioEnvironment()
      .then((next) => {
        if (!cancelled) setEnvironment(next)
      })
      .catch(() => {
        if (!cancelled) setEnvironment(null)
      })
      .finally(() => {
        if (!cancelled) setProbing(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function choose(route: KeaAudioRoute) {
    if (saving) return
    setSaving(true)
    try {
      await applyAudioRouteMic(route)
    } finally {
      markAudioRouteSessionDone()
      setSaving(false)
      onDone()
    }
  }

  const bluetoothLabel =
    environment?.devices.find((item) => item.role === 'bluetooth' && item.label)
      ?.label || ''

  return (
    <div
      className="audio-route"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-route-title"
    >
      <div className="audio-route__card">
        <h2 id="audio-route-title" className="audio-route__title">
          Check your audio
        </h2>
        <p className="audio-route__body">
          Are you using the phone speaker, headphones, or Bluetooth / car? Pick
          the one you have on now so Kea uses the right microphone.
        </p>
        {probing ? (
          <p className="audio-route__note">Reading what this phone lists…</p>
        ) : null}
        {environment?.bluetoothConnected ? (
          <p className="audio-route__note">
            Bluetooth detected
            {bluetoothLabel ? ` · ${bluetoothLabel}` : ''}. Tap Connect
            Bluetooth to use it.
          </p>
        ) : current ? (
          <p className="audio-route__note">
            Last time:{' '}
            {current === 'bluetooth'
              ? 'Bluetooth / car'
              : current === 'headphones'
                ? 'Headphones'
                : 'Phone speaker'}
          </p>
        ) : null}
        <div className="audio-route__actions">
          <button
            type="button"
            className="kea-button"
            disabled={saving}
            onClick={() => void choose('speaker')}
          >
            Phone speaker
          </button>
          <button
            type="button"
            className="kea-button"
            disabled={saving}
            onClick={() => void choose('headphones')}
          >
            Headphones
          </button>
          <button
            type="button"
            className="kea-button"
            disabled={saving}
            onClick={() => void choose('bluetooth')}
          >
            Connect Bluetooth
          </button>
        </div>
      </div>
    </div>
  )
}
