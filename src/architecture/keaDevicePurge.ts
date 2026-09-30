/**
 * Wipe Kea data stored on this browser/device after account deletion
 * (or when the user asks to clear local data).
 */
export function purgeKeaDeviceData() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('kea-') || key.startsWith('kea_'))) {
        keys.push(key)
      }
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('kea-') || key.startsWith('kea_'))) {
        keys.push(key)
      }
    }
    for (const key of keys) sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
  try {
    if ('caches' in window) {
      void caches.keys().then((names) => {
        for (const name of names) {
          if (name.startsWith('kea-') || name.includes('kea')) {
            void caches.delete(name)
          }
        }
      })
    }
  } catch {
    // ignore
  }
}
