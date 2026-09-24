const STORAGE_KEY = 'kea-welcome-title'

export const DEFAULT_WELCOME_TITLE = 'Chat with Kea & learn a language'

export function getWelcomeTitle(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored.trim()) return stored.trim()
  } catch {
    // ignore
  }
  return DEFAULT_WELCOME_TITLE
}

export function saveWelcomeTitle(text: string) {
  const next = text.trim() || DEFAULT_WELCOME_TITLE
  localStorage.setItem(STORAGE_KEY, next)
}

export function resetWelcomeTitle() {
  localStorage.removeItem(STORAGE_KEY)
}
