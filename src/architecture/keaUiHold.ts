import { useEffect } from 'react'

/**
 * Soft-pause Kea's mic while chat chrome is open (language picker, menus,
 * confirm dialogs, paywall). Nested holds are reference-counted.
 */

export const KEA_UI_HOLD = 'kea-ui-hold'
export const KEA_UI_RELEASE = 'kea-ui-release'

let holdCount = 0

export function isKeaUiHeld() {
  return holdCount > 0
}

export function holdKeaListening() {
  holdCount += 1
  if (holdCount === 1 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(KEA_UI_HOLD))
  }
}

export function releaseKeaListening() {
  if (holdCount === 0) return
  holdCount -= 1
  if (holdCount === 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(KEA_UI_RELEASE))
  }
}

/** Hold listening for as long as `active` is true. */
export function useHoldKeaListening(active: boolean) {
  useEffect(() => {
    if (!active) return
    holdKeaListening()
    return () => releaseKeaListening()
  }, [active])
}
