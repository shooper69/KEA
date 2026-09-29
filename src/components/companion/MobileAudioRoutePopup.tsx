import { useEffect, useState } from 'react'
import {
  clearAudioRoutePromptPending,
  type KeaAudioEnvironment,
} from '../../architecture/keaAudioRoute'
import { syncAudioRouteFromPhone } from '../../architecture/keaMicrophone'

interface MobileAudioRoutePopupProps {
  onDone: () => void
}

/**
 * After login on mobile: show what the phone already reports for talk audio
 * (Bluetooth / car, headphones, or phone speaker) and lock the mic to match.
 */
export function MobileAudioRoutePopup({ onDone }: MobileAudioRoutePopupProps) {
  const [environment, setEnvironment] = useState<KeaAudioEnvironment | null>(
    null,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    void syncAudioRouteFromPhone()
      .then((next) => {
        if (cancelled) return
        setEnvironment(next)
        setBusy(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not read audio devices on this phone.')
        setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function finish() {
    clearAudioRoutePromptPending()
    onDone()
  }

  const named = (environment?.devices ?? [])
    .filter((item) => item.label.trim())
    .slice(0, 4)

  return (
    <div
      className="audio-route"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-route-title"
    >
      <div className="audio-route__card">
        <h2 id="audio-route-title" className="audio-route__title">
          Your phone’s audio
        </h2>
        {busy ? (
          <p className="audio-route__body">Reading what this phone is set up for…</p>
        ) : error ? (
          <p className="audio-route__body">{error}</p>
        ) : environment ? (
          <>
            <p className="audio-route__body">{environment.summary}</p>
            <p className="audio-route__note">{environment.detail}</p>
            {named.length > 0 ? (
              <ul className="audio-route__devices">
                {named.map((item) => (
                  <li key={`${item.kind}-${item.deviceId}`}>
                    <span className="audio-route__device-kind">
                      {item.kind === 'output' ? 'Out' : 'In'}
                    </span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
        <div className="audio-route__actions">
          <button
            type="button"
            className="kea-button"
            disabled={busy}
            onClick={finish}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
