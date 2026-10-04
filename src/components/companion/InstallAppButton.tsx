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

/** iPhone / iPad / iPod (includes iPadOS that reports as MacIntel). */
export function isAppleMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Desktop Mac (not an iPad pretending to be MacIntel). */
export function isAppleMacDesktop() {
  if (typeof navigator === 'undefined') return false
  if (isAppleMobileDevice()) return false
  return /Macintosh|Mac OS X/i.test(navigator.userAgent)
}

export function isAppleSafariBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const safari = /Safari/i.test(ua)
  const other = /CriOS|Chrome|EdgiOS|Edg\/|FxiOS|Firefox|OPR|Opera/i.test(ua)
  return safari && !other
}

function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua)
}

export type PwaInstallGuide = {
  title: string
  lead: string
  steps: string[]
  footer?: string
}

/** Plain steps for the install popup — especially Apple, which has no Install button. */
export function pwaInstallGuide(): PwaInstallGuide {
  if (isAppleMobileDevice()) {
    const device = /iPad/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : 'iPhone'
    if (!isAppleSafariBrowser()) {
      return {
        title: 'Save Kea on your Apple device',
        lead: `On ${device}, Kea can only be saved from Safari — not from Chrome or an in-app browser.`,
        steps: [
          'Open Safari (the compass icon).',
          'Go to kea.chat and sign in if you need to.',
          'Tap the Share button — a square with an arrow pointing up. On iPhone it is at the bottom of Safari; on iPad it is at the top.',
          'Scroll the share sheet and tap Add to Home Screen.',
          'Tap Add. Kea appears on your Home Screen like any other app.',
        ],
        footer:
          'After that, open Kea from the Home Screen icon — not from a Safari tab.',
      }
    }
    return {
      title: 'Save Kea on your Apple device',
      lead: `Apple does not show an Install button. Use Safari’s Share menu on your ${device}:`,
      steps: [
        'Tap the Share button — a square with an arrow pointing up. On iPhone it sits at the bottom centre of Safari; on iPad it is near the top of the window.',
        'In the share sheet, scroll down and tap Add to Home Screen.',
        'If you do not see it, scroll further or tap Edit Actions and turn Add to Home Screen on.',
        'Tap Add (top right). Kea’s icon appears on your Home Screen.',
      ],
      footer:
        'Open Kea from that Home Screen icon next time. This works the same on iPhone and iPad.',
    }
  }

  if (isAppleMacDesktop()) {
    if (!isAppleSafariBrowser()) {
      return {
        title: 'Save Kea on your Mac',
        lead: 'On a Mac, save Kea from Safari (not Chrome).',
        steps: [
          'Open Safari and go to kea.chat.',
          'In the menu bar choose File → Add to Dock (wording can also say Add to Dock / Add to Home Screen).',
          'Or click the Share button in the Safari toolbar, then Add to Dock.',
          'Kea appears in your Dock — open it from there like an app.',
        ],
        footer: 'Needs a recent macOS with Safari that supports web apps.',
      }
    }
    return {
      title: 'Save Kea on your Mac',
      lead: 'Safari on Mac can put Kea in your Dock as an app:',
      steps: [
        'In the menu bar, choose File → Add to Dock (or Add to Home Screen on some macOS versions).',
        'You can also click the Share button in the Safari toolbar, then choose Add to Dock.',
        'Confirm Add. Kea appears in your Dock with its own icon.',
      ],
      footer: 'Open Kea from the Dock next time — it runs in its own window.',
    }
  }

  if (isAndroidChrome()) {
    return {
      title: 'Install Kea on your phone',
      lead: 'Chrome can install Kea as an app on your home screen.',
      steps: [
        'Tap the ⋮ menu at the top right.',
        'Tap Install app or Add to Home screen.',
        'Confirm Install. Open Kea from the new home-screen icon.',
      ],
      footer:
        'If you do not see Install app, open kea.chat in Chrome (not inside another app) and try again after a short browse.',
    }
  }

  return {
    title: 'Install Kea on this device',
    lead: 'Use your browser’s install option to put Kea on your home screen or dock.',
    steps: [
      'Open the browser menu (often ⋮ or ⋯).',
      'Choose Install app or Add to Home Screen.',
      'Confirm, then open Kea from the new icon.',
    ],
    footer:
      'On Apple devices, use Safari. On Android, Chrome is the simplest path.',
  }
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
    const guide = pwaInstallGuide()
    const steps = guide.steps.map((step, index) => `${index + 1}. ${step}`).join(' ')
    return [guide.lead, steps, guide.footer].filter(Boolean).join(' ')
  }

  return {
    deferred,
    installed,
    busy,
    canPrompt: Boolean(deferred || sharedDeferred),
    promptInstall,
    manualInstallHint,
    pwaInstallGuide,
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
