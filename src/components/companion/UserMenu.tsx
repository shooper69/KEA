import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
import { useSession } from '../../context/SessionContext'
import { useStickyMenu } from '../../hooks/useStickyMenu'
import { usePwaInstall } from './InstallAppButton'
import { ProfileFace } from './ProfileFace'

export function UserMenu() {
  const { firstName, lastName, email, photoDataUrl, isAdmin, isSignedIn, signOut } =
    useSession()
  const navigate = useNavigate()
  const { rootRef, open, setOpen, onPointerLeave } = useStickyMenu()
  useHoldKeaListening(open)
  const { installed, busy, promptInstall, manualInstallHint } = usePwaInstall()
  const [comingSoon, setComingSoon] = useState<string | null>(null)
  const [installAsk, setInstallAsk] = useState(false)
  const [installNote, setInstallNote] = useState('')

  function goSettings() {
    setOpen(false)
    navigate('/settings')
  }

  async function leave() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  function showComingSoon(store: string) {
    setComingSoon(store)
  }

  function askInstallApp() {
    setOpen(false)
    if (installed) {
      setInstallNote('Kea is already installed on this phone.')
      return
    }
    setInstallAsk(true)
  }

  async function confirmInstallApp() {
    setInstallAsk(false)
    const result = await promptInstall()
    if (result === 'manual') {
      setInstallNote(manualInstallHint())
    }
  }

  return (
    <div className="user-menu" ref={rootRef} onPointerLeave={onPointerLeave}>
      <button
        type="button"
        className="user-menu__avatar"
        aria-label="Account settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileFace
          photoDataUrl={photoDataUrl}
          firstName={firstName}
          lastName={lastName}
        />
      </button>
      {open ? (
        <div
          className="user-menu__dropdown"
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="user-menu__email">{email}</p>
          <button type="button" role="menuitem" onClick={goSettings}>
            Settings
          </button>
          <Link
            role="menuitem"
            to="/performance"
            onClick={() => setOpen(false)}
          >
            Performance
          </Link>
          <Link role="menuitem" to="/usage" onClick={() => setOpen(false)}>
            Usage
          </Link>
          <Link
            role="menuitem"
            to="/subscription"
            onClick={() => setOpen(false)}
          >
            Subscription
          </Link>
          <Link role="menuitem" to="/support" onClick={() => setOpen(false)}>
            Customer Support
          </Link>
          <Link role="menuitem" to="/about" onClick={() => setOpen(false)}>
            About
          </Link>
          {isAdmin ? (
            <Link
              role="menuitem"
              to="/conversation?onboarding=1"
              onClick={() => setOpen(false)}
            >
              Onboarding
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              role="menuitem"
              to="/admin"
              className="user-menu__admin"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          ) : null}
          {isSignedIn ? (
            <button type="button" role="menuitem" onClick={() => void leave()}>
              Sign out
            </button>
          ) : null}
          <div className="user-menu__stores" role="group" aria-label="Get Kea">
            <button
              type="button"
              role="menuitem"
              className="user-menu__store"
              onClick={() => showComingSoon('Playstore')}
            >
              Playstore
            </button>
            <button
              type="button"
              role="menuitem"
              className="user-menu__store"
              onClick={() => showComingSoon('Apple store')}
            >
              Apple store
            </button>
            <button
              type="button"
              role="menuitem"
              className="user-menu__store"
              disabled={busy}
              onClick={askInstallApp}
            >
              {installed ? 'Phone App ✓' : busy ? 'Installing…' : 'Phone App'}
            </button>
          </div>
        </div>
      ) : null}
      {comingSoon ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-store-soon-title"
          onClick={() => setComingSoon(null)}
        >
          <div
            className="kea-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-store-soon-title" className="kea-confirm__title">
              Coming soon
            </p>
            <p className="kea-confirm__note">
              The {comingSoon} listing is not ready yet. Use Phone App to put
              Kea on your home screen now.
            </p>
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button"
                onClick={() => setComingSoon(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {installAsk ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-install-app-title"
          onClick={() => setInstallAsk(false)}
        >
          <div
            className="kea-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-install-app-title" className="kea-confirm__title">
              Install app on your phone?
            </p>
            <p className="kea-confirm__note">
              This adds Kea to your home screen with an app icon, so you can
              open it like a normal phone app.
            </p>
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button kea-button--ghost"
                onClick={() => setInstallAsk(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kea-button"
                disabled={busy}
                onClick={() => void confirmInstallApp()}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {installNote ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-install-note-title"
          onClick={() => setInstallNote('')}
        >
          <div
            className="kea-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-install-note-title" className="kea-confirm__title">
              Phone App
            </p>
            <p className="kea-confirm__note">{installNote}</p>
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button"
                onClick={() => setInstallNote('')}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
