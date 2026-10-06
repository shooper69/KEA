import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  audioRouteSurface,
  markAudioRouteSessionDone,
  probeAudioEnvironment,
  readAudioRoute,
  type KeaAudioEnvironment,
  type KeaAudioRoute,
  type KeaAudioSurface,
} from '../../architecture/keaAudioRoute'
import {
  applyAudioRouteMic,
  applyPcAudioDevices,
  listAudioInputs,
  listAudioOutputs,
  readPreferredOutputId,
} from '../../architecture/keaMicrophone'

interface MobileAudioRoutePopupProps {
  onDone: () => void
}

type SidePanel = 'phone' | 'pc' | null

function deviceLabel(item: MediaDeviceInfo, fallback: string) {
  const label = item.label.replace(/\s+/g, ' ').trim()
  if (label) return label
  if (item.deviceId === 'default') return `Default ${fallback}`
  if (item.deviceId === 'communications') return `Communications ${fallback}`
  return `${fallback} (${item.deviceId.slice(0, 8)}…)`
}

/**
 * Primary chooser: Phone / PC / Bluetooth.
 * Phone and PC open a side panel for the concrete input/output options.
 */
export function MobileAudioRoutePopup({ onDone }: MobileAudioRoutePopupProps) {
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(true)
  const [environment, setEnvironment] = useState<KeaAudioEnvironment | null>(
    null,
  )
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [panel, setPanel] = useState<SidePanel>(null)
  const [pcInputId, setPcInputId] = useState('')
  const [pcOutputId, setPcOutputId] = useState('')
  const [route, setRoute] = useState<KeaAudioRoute | null>(() => readAudioRoute())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await probeAudioEnvironment()
        if (cancelled) return
        setEnvironment(next)
        const [inList, outList] = await Promise.all([
          listAudioInputs(),
          listAudioOutputs(),
        ])
        if (cancelled) return
        setInputs(inList)
        setOutputs(outList)
        const savedMic = inList.find((item) => item.deviceId === readSavedMicHint())
        const savedOut = outList.find(
          (item) => item.deviceId === readPreferredOutputId(),
        )
        setPcInputId(savedMic?.deviceId || inList[0]?.deviceId || '')
        setPcOutputId(savedOut?.deviceId || outList[0]?.deviceId || '')
      } catch {
        if (!cancelled) setEnvironment(null)
      } finally {
        if (!cancelled) setProbing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const liveSurface = audioRouteSurface(route)

  const bluetoothDevices = useMemo(
    () =>
      (environment?.devices || []).filter(
        (item) => item.role === 'bluetooth' && item.label.trim(),
      ),
    [environment],
  )

  async function choosePhone(next: 'speaker' | 'headphones') {
    if (saving) return
    setSaving(true)
    try {
      await applyAudioRouteMic(next)
      setRoute(next)
    } finally {
      markAudioRouteSessionDone()
      setSaving(false)
      onDone()
    }
  }

  async function chooseBluetooth() {
    if (saving) return
    setSaving(true)
    try {
      await applyAudioRouteMic('bluetooth')
      setRoute('bluetooth')
    } finally {
      markAudioRouteSessionDone()
      setSaving(false)
      onDone()
    }
  }

  async function choosePc() {
    if (saving || !pcInputId) return
    setSaving(true)
    try {
      await applyPcAudioDevices({
        inputDeviceId: pcInputId,
        outputDeviceId: pcOutputId || undefined,
      })
      setRoute('pc')
    } finally {
      markAudioRouteSessionDone()
      setSaving(false)
      onDone()
    }
  }

  function openSurface(surface: KeaAudioSurface) {
    if (surface === 'bluetooth') {
      void chooseBluetooth()
      return
    }
    // Always open the requested side panel (do not toggle-close on the same tap).
    setPanel(surface)
  }

  return createPortal(
    <div
      className="audio-route"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-route-title"
    >
      <div className={`audio-route__shell${panel ? ' has-panel' : ''}`}>
        <div className="audio-route__card">
          <h2 id="audio-route-title" className="audio-route__title">
            Check your audio
          </h2>
          <p className="audio-route__body">
            Choose where you are talking from. Phone and this computer open more
            options on the side.
          </p>
          {probing ? (
            <p className="audio-route__note">Reading available devices…</p>
          ) : null}
          {bluetoothDevices[0]?.label ? (
            <p className="audio-route__note">
              Bluetooth seen · {bluetoothDevices[0].label}
            </p>
          ) : route ? (
            <p className="audio-route__note">
              Live:{' '}
              {route === 'pc'
                ? 'This computer'
                : route === 'bluetooth'
                  ? 'Bluetooth'
                  : route === 'headphones'
                    ? 'Phone · Headphones'
                    : 'Phone · Speaker'}
            </p>
          ) : null}
          <div className="audio-route__actions">
            <button
              type="button"
              className={`kea-button audio-route__choice${
                liveSurface === 'phone' || panel === 'phone'
                  ? ' audio-route__choice--live'
                  : ''
              }`}
              aria-current={liveSurface === 'phone' ? 'true' : undefined}
              aria-expanded={panel === 'phone'}
              disabled={saving}
              onClick={() => openSurface('phone')}
            >
              Phone
            </button>
            <button
              type="button"
              className={`kea-button audio-route__choice${
                liveSurface === 'pc' || panel === 'pc'
                  ? ' audio-route__choice--live'
                  : ''
              }`}
              aria-current={liveSurface === 'pc' ? 'true' : undefined}
              aria-expanded={panel === 'pc'}
              disabled={saving}
              onClick={() => openSurface('pc')}
            >
              This computer
            </button>
            <button
              type="button"
              className={`kea-button audio-route__choice${
                liveSurface === 'bluetooth' ? ' audio-route__choice--live' : ''
              }`}
              aria-current={liveSurface === 'bluetooth' ? 'true' : undefined}
              disabled={saving}
              onClick={() => openSurface('bluetooth')}
            >
              Bluetooth
            </button>
          </div>
          <button
            type="button"
            className="audio-route__dismiss"
            disabled={saving}
            onClick={() => {
              markAudioRouteSessionDone()
              onDone()
            }}
          >
            Not now
          </button>
          {panel === 'pc' ? (
            <button
              type="button"
              className="audio-route__save"
              disabled={saving || !pcInputId}
              onClick={() => void choosePc()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>

        {panel === 'phone' ? (
          <aside
            className="audio-route__panel"
            aria-label="Phone audio options"
          >
            <div className="audio-route__panel-head">
              <h3 className="audio-route__panel-title">Phone</h3>
              <button
                type="button"
                className="audio-route__panel-close"
                aria-label="Close phone options"
                onClick={() => setPanel(null)}
              >
                ✕
              </button>
            </div>
            <p className="audio-route__panel-note">
              Pick the phone path Kea should use.
            </p>
            <div className="audio-route__actions audio-route__actions--panel">
              <button
                type="button"
                className={`kea-button audio-route__choice${
                  route === 'speaker' ? ' audio-route__choice--live' : ''
                }`}
                disabled={saving}
                onClick={() => void choosePhone('speaker')}
              >
                Phone speaker
              </button>
              <button
                type="button"
                className={`kea-button audio-route__choice${
                  route === 'headphones' ? ' audio-route__choice--live' : ''
                }`}
                disabled={saving}
                onClick={() => void choosePhone('headphones')}
              >
                Headphones
              </button>
            </div>
          </aside>
        ) : null}

        {panel === 'pc' ? (
          <>
            <aside
              className="audio-route__panel audio-route__panel--devices"
              aria-label="Computer microphones"
            >
              <div className="audio-route__panel-head">
                <h3 className="audio-route__panel-title">This computer</h3>
                <button
                  type="button"
                  className="audio-route__panel-close"
                  aria-label="Close computer options"
                  onClick={() => setPanel(null)}
                >
                  ✕
                </button>
              </div>
              <p className="audio-route__panel-note">
                Choose the microphone Kea listens on, and where you hear her.
              </p>
              <div className="audio-route__device-block">
                <p className="audio-route__device-heading">Input (microphone)</p>
                <ul className="audio-route__device-list">
                  {inputs.length === 0 ? (
                    <li className="audio-route__device-empty">
                      No microphones listed yet. Allow mic access and try again.
                    </li>
                  ) : (
                    inputs.map((item) => (
                      <li key={`in-${item.deviceId}`}>
                        <button
                          type="button"
                          className={`audio-route__device${
                            pcInputId === item.deviceId
                              ? ' audio-route__device--live'
                              : ''
                          }`}
                          disabled={saving}
                          onClick={() => setPcInputId(item.deviceId)}
                        >
                          {deviceLabel(item, 'microphone')}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </aside>
            <aside
              className="audio-route__panel audio-route__panel--devices"
              aria-label="Computer speakers"
            >
              <div className="audio-route__device-block">
                <p className="audio-route__device-heading">Output (speakers)</p>
                <ul className="audio-route__device-list">
                  {outputs.length === 0 ? (
                    <li className="audio-route__device-empty">
                      This browser only lists speakers after permission, or may
                      use the system default.
                    </li>
                  ) : (
                    outputs.map((item) => (
                      <li key={`out-${item.deviceId}`}>
                        <button
                          type="button"
                          className={`audio-route__device${
                            pcOutputId === item.deviceId
                              ? ' audio-route__device--live'
                              : ''
                          }`}
                          disabled={saving}
                          onClick={() => setPcOutputId(item.deviceId)}
                        >
                          {deviceLabel(item, 'speakers')}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

function readSavedMicHint(): string {
  try {
    return localStorage.getItem('kea-preferred-mic-id')?.trim() || ''
  } catch {
    return ''
  }
}
