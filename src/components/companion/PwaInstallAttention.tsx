import { useState } from 'react'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
import { isKeaNativeApp } from '../../lib/keaNative'
import { usePwaInstall } from './InstallAppButton'

/**
 * Red “!” beside the Kea mark when the chat is opened in a browser
 * (not the installed PWA / Play app). Opens an install explain + install flow.
 */
export function PwaInstallAttention() {
  const { installed, busy, canPrompt, promptInstall, pwaInstallGuide } =
    usePwaInstall()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  useHoldKeaListening(open || Boolean(note))

  if (isKeaNativeApp() || installed) return null

  const guide = pwaInstallGuide()

  async function install() {
    if (!canPrompt) {
      setOpen(false)
      return
    }
    const result = await promptInstall()
    setOpen(false)
    if (result === 'manual') {
      setNote('manual')
      return
    }
    if (result === 'accepted') {
      setNote('Kea is on your home screen. Open it from the app icon.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="companion-nav__pwa-alert"
        aria-label="Save Kea on this device"
        title="Save Kea on this device"
        onClick={() => setOpen(true)}
      >
        !
      </button>
      {open ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-pwa-install-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="kea-confirm__card kea-confirm__card--pwa"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-pwa-install-title" className="kea-confirm__title">
              {guide.title}
            </p>
            <p className="kea-confirm__note">{guide.lead}</p>
            <ol className="kea-confirm__steps">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {guide.footer ? (
              <p className="kea-confirm__note kea-confirm__note--hint">
                {guide.footer}
              </p>
            ) : null}
            <div className="kea-confirm__actions">
              {canPrompt ? (
                <button
                  type="button"
                  className="kea-button kea-button--ghost"
                  onClick={() => setOpen(false)}
                >
                  Not now
                </button>
              ) : null}
              <button
                type="button"
                className="kea-button"
                disabled={busy}
                onClick={() => void install()}
              >
                {busy ? 'Installing…' : canPrompt ? 'Install' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {note ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-pwa-note-title"
          onClick={() => setNote('')}
        >
          <div
            className="kea-confirm__card kea-confirm__card--pwa"
            onClick={(event) => event.stopPropagation()}
          >
            {note === 'manual' ? (
              <>
                <p id="kea-pwa-note-title" className="kea-confirm__title">
                  {guide.title}
                </p>
                <p className="kea-confirm__note">{guide.lead}</p>
                <ol className="kea-confirm__steps">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {guide.footer ? (
                  <p className="kea-confirm__note kea-confirm__note--hint">
                    {guide.footer}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p id="kea-pwa-note-title" className="kea-confirm__title">
                  Kea app
                </p>
                <p className="kea-confirm__note">{note}</p>
              </>
            )}
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button"
                onClick={() => setNote('')}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
