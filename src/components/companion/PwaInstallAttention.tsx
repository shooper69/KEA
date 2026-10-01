import { useState } from 'react'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
import { isKeaNativeApp } from '../../lib/keaNative'
import { usePwaInstall } from './InstallAppButton'

/**
 * Red “!” beside the Kea mark when the chat is opened in a browser
 * (not the installed PWA / Play app). Opens an install explain + install flow.
 */
export function PwaInstallAttention() {
  const { installed, busy, canPrompt, promptInstall, manualInstallHint } =
    usePwaInstall()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  useHoldKeaListening(open || Boolean(note))

  if (isKeaNativeApp() || installed) return null

  async function install() {
    if (!canPrompt) {
      setOpen(false)
      return
    }
    const result = await promptInstall()
    setOpen(false)
    if (result === 'manual') {
      setNote(manualInstallHint())
      return
    }
    if (result === 'accepted') {
      setNote('Kea is on your home screen. Open it from the app icon.')
    }
  }

  return (
    <>
      <div className="companion-nav__pwa-slot">
        <button
          type="button"
          className="companion-nav__pwa-alert"
          aria-label="Install Kea on your phone"
          title="Install Kea on your phone"
          onClick={() => setOpen(true)}
        >
          !
        </button>
      </div>
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
              Put Kea on your phone
            </p>
            <p className="kea-confirm__note">
              Install Kea as an app on your home screen. You get a proper app
              icon, fuller-screen chat, and quicker return when you want to
              talk — without going through the browser each time.
            </p>
            {!canPrompt ? (
              <p className="kea-confirm__note kea-confirm__note--hint">
                {manualInstallHint()}
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
            className="kea-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-pwa-note-title" className="kea-confirm__title">
              Phone app
            </p>
            <p className="kea-confirm__note">{note}</p>
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
