/**
 * Keep the phone screen awake during hands-free voice (Screen Wake Lock API).
 * No-op on browsers that do not support it.
 */

export type ScreenWakeLockSentinel = {
  released: boolean
  release: () => Promise<void>
  addEventListener: (
    type: 'release',
    listener: () => void,
    options?: { once?: boolean },
  ) => void
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<ScreenWakeLockSentinel>
  }
}

let sentinel: ScreenWakeLockSentinel | null = null
let wantLock = false
let reacquireBound = false

function wakeLockApi() {
  if (typeof navigator === 'undefined') return null
  return (navigator as WakeLockNavigator).wakeLock ?? null
}

async function acquire() {
  const api = wakeLockApi()
  if (!api || !wantLock) return
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return
  }
  if (sentinel && !sentinel.released) return
  try {
    sentinel = await api.request('screen')
    sentinel.addEventListener(
      'release',
      () => {
        sentinel = null
        if (wantLock && document.visibilityState === 'visible') {
          void acquire()
        }
      },
      { once: true },
    )
  } catch {
    sentinel = null
  }
}

async function release() {
  const current = sentinel
  sentinel = null
  if (!current || current.released) return
  try {
    await current.release()
  } catch {
    // ignore
  }
}

function onVisibility() {
  if (document.visibilityState === 'visible' && wantLock) {
    void acquire()
  }
}

function ensureVisibilityListener() {
  if (reacquireBound || typeof document === 'undefined') return
  reacquireBound = true
  document.addEventListener('visibilitychange', onVisibility)
}

/** Hold or release the screen wake lock. Safe to call often. */
export function setScreenWakeLock(active: boolean) {
  wantLock = active
  ensureVisibilityListener()
  if (active) void acquire()
  else void release()
}

export function isScreenWakeLockSupported() {
  return Boolean(wakeLockApi())
}
