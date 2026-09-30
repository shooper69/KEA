import { useEffect, useState } from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chrome = /CriOS|Chrome|EdgiOS|FxiOS/.test(ua)
  return iOS && webkit && !chrome
}

/** Shared PWA install state for menu + welcome install buttons. */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(isStandaloneDisplay)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    setInstalled(isStandaloneDisplay())
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
    if (installed) return 'accepted'
    if (deferred) {
      setBusy(true)
      try {
        await deferred.prompt()
        const choice = await deferred.userChoice
        if (choice.outcome === 'accepted') setInstalled(true)
        setDeferred(null)
        return choice.outcome
      } finally {
        setBusy(false)
      }
    }
    return 'manual'
  }

  function manualInstallHint() {
    if (isIosSafari()) {
      return 'On iPhone: tap Share, then Add to Home Screen.'
    }
    return 'Use your browser menu → Install app or Add to Home Screen. Open kea.chat in Chrome on Android for the simplest install.'
  }

  return {
    deferred,
    installed,
    busy,
    canPrompt: Boolean(deferred),
    promptInstall,
    manualInstallHint,
  }
}

type InstallAppVariant = 'store' | 'header'

/**
 * Install Kea as a Progressive Web App (home-screen app).
 * `store` — compact button beside the Play badge (PC / tablet).
 * `header` — “Get the app” text control (phone).
 */
export function InstallAppButton({
  className = '',
  variant = 'store',
}: {
  className?: string
  variant?: InstallAppVariant
}) {
  const { installed, busy, promptInstall, manualInstallHint } = usePwaInstall()

  if (installed) return null

  async function install() {
    const result = await promptInstall()
    if (result === 'manual') window.alert(manualInstallHint())
  }

  if (variant === 'header') {
    return (
      <button
        type="button"
        className={`welcome-top-link ${className}`.trim()}
        disabled={busy}
        onClick={() => void install()}
      >
        {busy ? 'Installing…' : 'Get the app'}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`install-app__store-button ${className}`.trim()}
      disabled={busy}
      onClick={() => void install()}
      title="Install Kea on your phone"
    >
      {busy ? 'Installing…' : 'Install the app'}
    </button>
  )
}
