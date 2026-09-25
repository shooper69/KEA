import { useState } from 'react'
import {
  clearAudioRoutePromptPending,
  readAudioRoute,
  type KeaAudioRoute,
} from '../../architecture/keaAudioRoute'
import { applyAudioRouteMic } from '../../architecture/keaMicrophone'

interface MobileAudioRoutePopupProps {
  onDone: () => void
}

/** Mobile login check: phone speaker vs headphones for the right mic. */
export function MobileAudioRoutePopup({ onDone }: MobileAudioRoutePopupProps) {
  const [saving, setSaving] = useState(false)
  const current = readAudioRoute()

  async function choose(route: KeaAudioRoute) {
    if (saving) return
    setSaving(true)
    try {
      await applyAudioRouteMic(route)
    } finally {
      clearAudioRoutePromptPending()
      setSaving(false)
      onDone()
    }
  }

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
          Are you using the phone speaker, or headphones? Pick the one you have
          on now so Kea uses the right microphone.
        </p>
        {current ? (
          <p className="audio-route__note">
            Last time: {current === 'headphones' ? 'Headphones' : 'Phone speaker'}
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
        </div>
      </div>
    </div>
  )
}
