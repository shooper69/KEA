/** Marketing-page background. Colour graded is the default wash; black is opt-in. */

const STORAGE_KEY = 'kea-marketing-background-v1'
export const MARKETING_BACKGROUND_EVENT = 'kea-marketing-background'

export type MarketingBackground = 'graded' | 'black'

export function readMarketingBackground(): MarketingBackground {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'black' ? 'black' : 'graded'
  } catch {
    return 'graded'
  }
}

export function saveMarketingBackground(value: MarketingBackground) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(MARKETING_BACKGROUND_EVENT))
}

export function isMarketingPath(pathname: string) {
  return pathname === '/' || pathname === '/method' || pathname === '/what-is-kea'
}
