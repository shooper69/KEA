import { useEffect, useState, useSyncExternalStore } from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Survives React Strict Mode remounts — beforeinstallprompt only fires once. */
let sharedDeferred: BeforeInstallPromptEvent | null = null
let sharedInstalled =
  typeof window !== 'undefined' ? readStandalone() : false
const installListeners = new Set<() => void>()

function readStandalone() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

function notifyInstallListeners() {
  for (const listener of installListeners) listener()
}

function subscribeInstall(listener: () => void) {
  installListeners.add(listener)
  return () => {
    installListeners.delete(listener)
  }
}

let bridgeReady = false
function ensureInstallBridge() {
  if (bridgeReady || typeof window === 'undefined') return
  bridgeReady = true
  sharedInstalled = readStandalone()
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    sharedDeferred = event as BeforeInstallPromptEvent
    notifyInstallListeners()
  })
  window.addEventListener('appinstalled', () => {
    sharedInstalled = true
    sharedDeferred = null
    notifyInstallListeners()
  })
  window
    .matchMedia('(display-mode: standalone)')
    .addEventListener('change', () => {
      sharedInstalled = readStandalone()
      notifyInstallListeners()
    })
}

export function isStandaloneDisplay() {
  ensureInstallBridge()
  return sharedInstalled || readStandalone()
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

function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua)
}

/** Shared PWA install state for menu + welcome install buttons. */
export function usePwaInstall() {
  ensureInstallBridge()
  const deferred = useSyncExternalStore(
    subscribeInstall,
    () => sharedDeferred,
    () => null,
  )
  const installed = useSyncExternalStore(
    subscribeInstall,
    () => sharedInstalled || readStandalone(),
    () => false,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ensureInstallBridge()
    sharedInstalled = readStandalone()
    notifyInstallListeners()
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
    if (installed || sharedInstalled || readStandalone()) {
      sharedInstalled = true
      return 'accepted'
    }
    const event = sharedDeferred || deferred
    if (event) {
      setBusy(true)
      try {
        // Must run in the same user gesture as the Install tap.
        await event.prompt()
        const choice = await event.userChoice
        if (choice.outcome === 'accepted') {
          sharedInstalled = true
          sharedDeferred = null
          notifyInstallListeners()
        } else {
          // Chrome invalidates the event after one prompt(); keep listening for a new one.
          sharedDeferred = null
          notifyInstallListeners()
        }
        return choice.outcome
      } catch {
        sharedDeferred = null
        notifyInstallListeners()
        return 'manual'
      } finally {
        setBusy(false)
      }
    }
    return 'manual'
  }

  function manualInstallHint() {
    if (isIosSafari()) {
      return 'On iPhone: tap the Share button, then Add to Home Screen.'
    }
    if (isAndroidChrome()) {
      return 'In Chrome, tap the ⋮ menu (top right), then Install app or Add to Home screen. If you do not see Install app, open kea.chat in Chrome (not inside another app) and try again after browsing a little.'
    }
    return 'Use your browser menu → Install app or Add to Home Screen. Chrome on Android is the simplest path.'
  }

  return {
    deferred,
    installed,
    busy,
    canPrompt: Boolean(deferred || sharedDeferred),
    promptInstall,
    manualInstallHint,
  }
}

type InstallAppVariant = 'store' | 'header'

/**
 * Install Kea as a Progressive Web App (home-screen app).
 * `store` — compact button beside the store badges.
 * `header` — “Get the app” text control.
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
