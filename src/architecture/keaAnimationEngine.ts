type KeaTick = (time: number, dt: number) => void

const listeners = new Set<KeaTick>()
let raf = 0
let last = 0
let running = false

function loop(now: number) {
  raf = window.requestAnimationFrame(loop)
  last = now
  const dt = Math.min(0.048, Math.max(0.001, (now - lastStamp) / 1000))
  lastStamp = now
  for (const tick of listeners) tick(now, dt)
}

let lastStamp = 0
let stallTimer = 0

function hideRestartBanner() {
  document.getElementById('kea-restart-banner')?.remove()
}

function showRestartBanner() {
  if (document.getElementById('kea-restart-banner')) return
  const link = document.createElement('a')
  link.id = 'kea-restart-banner'
  link.className = 'kea-restart-banner'
  link.href = `${window.location.origin}/conversation?restart=${Date.now()}`
  link.textContent = 'Restart Kea'
  document.body.appendChild(link)
}

export function startKeaAnimationEngine() {
  if (typeof window === 'undefined' || running) return
  running = true
  document.documentElement.classList.add('kea-motion')
  last = performance.now()
  lastStamp = last
  raf = window.requestAnimationFrame(loop)
  window.addEventListener('visibilitychange', () => {
    last = performance.now()
    hideRestartBanner()
  })
  stallTimer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    if (performance.now() - last < 8000) {
      hideRestartBanner()
      return
    }
    showRestartBanner()
  }, 4000)
}

export function stopKeaAnimationEngine() {
  running = false
  if (raf) window.cancelAnimationFrame(raf)
  raf = 0
  if (stallTimer) window.clearInterval(stallTimer)
  stallTimer = 0
  hideRestartBanner()
}

export function subscribeKeaMotion(tick: KeaTick) {
  startKeaAnimationEngine()
  listeners.add(tick)
  return () => {
    listeners.delete(tick)
  }
}

export function keaEaseOut(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return 1 - (1 - x) * (1 - x)
}
