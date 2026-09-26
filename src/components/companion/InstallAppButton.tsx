import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chrome = /CriOS|Chrome|EdgiOS|FxiOS/.test(ua)
  return iOS && webkit && !chrome
}

/**
 * Install Kea as a Progressive Web App (home-screen app).
 * Chrome/Edge/Android: native install prompt when available.
 * iPhone Safari: Add to Home Screen steps.
 */
export function InstallAppButton({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(isStandaloneDisplay)
  const [iosHint, setIosHint] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
      setIosHint(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    setInstalled(isStandaloneDisplay())
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <p className={`install-app__status ${className}`.trim()}>
        Kea is installed on this device.
      </p>
    )
  }

  async function install() {
    if (deferred) {
      setBusy(true)
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === 'accepted') setInstalled(true)
      } finally {
        setDeferred(null)
        setBusy(false)
      }
      return
    }
    if (isIosSafari()) {
      setIosHint(true)
      return
    }
    setIosHint(true)
  }

  return (
    <div className={`install-app ${className}`.trim()}>
      <button
        type="button"
        className="kea-button install-app__button"
        disabled={busy}
        onClick={() => void install()}
      >
        {busy ? 'Installing…' : 'Install the app'}
      </button>
      {iosHint ? (
        <p className="install-app__hint">
          {isIosSafari() ? (
            <>
              On iPhone: tap <strong>Share</strong>, then{' '}
              <strong>Add to Home Screen</strong>.
            </>
          ) : (
            <>
              Use your browser menu → <strong>Install app</strong> or{' '}
              <strong>Add to Home Screen</strong>. Open kea.chat in Chrome on
              Android for the simplest install.
            </>
          )}
        </p>
      ) : (
        <p className="install-app__hint install-app__hint--quiet">
          Hands-free on your phone — updates automatically when you open Kea.
        </p>
      )}
    </div>
  )
}
