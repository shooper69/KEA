import { useEffect, useState, useSyncExternalStore } from 'react'
import { isKeaNativeApp } from '../../lib/keaNative'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const PWA_INSTALLED_KEY = 'kea-pwa-installed-v1'

/** Survives React Strict Mode remounts — beforeinstallprompt only fires once. */
let sharedDeferred: BeforeInstallPromptEvent | null = null
let sharedInstalled =
  typeof window !== 'undefined' ? readInstalled() : false
const installListeners = new Set<() => void>()

function readPersistedInstall() {
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

function persistInstall() {
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, '1')
  } catch {
    // ignore
  }
}

function readStandalone() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

function readInstalled() {
  return isKeaNativeApp() || readStandalone() || readPersistedInstall()
}

function markInstalled() {
  persistInstall()
  sharedInstalled = true
  notifyInstallListeners()
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
  if (readInstalled()) markInstalled()
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    sharedDeferred = event as BeforeInstallPromptEvent
    notifyInstallListeners()
  })
  window.addEventListener('appinstalled', () => {
    sharedDeferred = null
    markInstalled()
  })
  window
    .matchMedia('(display-mode: standalone)')
    .addEventListener('change', () => {
      if (readStandalone()) markInstalled()
      else {
        sharedInstalled = readInstalled()
        notifyInstallListeners()
      }
    })
}

/** True in Capacitor, standalone PWA, or after a successful install on this device. */
export function hasInstalledKeaApp() {
  ensureInstallBridge()
  return readInstalled()
}

export function isStandaloneDisplay() {
  ensureInstallBridge()
  return sharedInstalled || readInstalled()
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
    () => sharedInstalled || readInstalled(),
    () => false,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ensureInstallBridge()
    if (readInstalled()) markInstalled()
    else notifyInstallListeners()
  }, [])

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
    if (installed || sharedInstalled || readInstalled()) {
      markInstalled()
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
          sharedDeferred = null
          markInstalled()
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

  // Keep the marketing-footer control visible; only hide the header link once installed.
  if (installed && variant !== 'store') return null

  async function install() {
    if (installed) {
      window.alert('Kea is already installed on this device.')
      return
    }
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
