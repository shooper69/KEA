import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { startKeaAnimationEngine } from './architecture/keaAnimationEngine'
import App from './App.tsx'
import './index.css'

startKeaAnimationEngine()

const bootUrl = new URL(window.location.href)
if (bootUrl.searchParams.has('restart')) {
  bootUrl.searchParams.delete('restart')
  const next = `${bootUrl.pathname}${bootUrl.search}${bootUrl.hash}`
  window.history.replaceState(null, '', next)
}

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
