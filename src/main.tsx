import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { startKeaAnimationEngine } from './architecture/keaAnimationEngine'
import { isKeaNativeApp } from './lib/keaNative'
import App from './App.tsx'
import './index.css'

const CRAWL_FILES = new Set(['/sitemap.xml', '/robots.txt', '/llms.txt'])
const isCrawlDocument = CRAWL_FILES.has(window.location.pathname)

async function releaseCrawlDocuments() {
  if (!isCrawlDocument) return false
  if (sessionStorage.getItem('kea-crawl-sw-cleared') === '1') return false
  sessionStorage.setItem('kea-crawl-sw-cleared', '1')
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  window.location.replace(window.location.pathname)
  return true
}

if (!isCrawlDocument) startKeaAnimationEngine()

const bootUrl = new URL(window.location.href)
if (bootUrl.searchParams.has('restart')) {
  bootUrl.searchParams.delete('restart')
  const next = `${bootUrl.pathname}${bootUrl.search}${bootUrl.hash}`
  window.history.replaceState(null, '', next)
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

void releaseCrawlDocuments().then((reloading) => {
  if (reloading || isCrawlDocument) return
  if (!isKeaNativeApp()) {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateSW(true)
      },
    })
  }
})

if (!isCrawlDocument) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
