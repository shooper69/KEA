type KeaTick = (time: number, dt: number) => void

const listeners = new Set<KeaTick>()
let raf = 0
let last = 0
let running = false

function loop(now: number) {
  raf = window.requestAnimationFrame(loop)
  const dt = Math.min(0.048, Math.max(0.001, (now - last) / 1000))
  last = now
  for (const tick of listeners) tick(now, dt)
}

export function startKeaAnimationEngine() {
  if (typeof window === 'undefined' || running) return
  running = true
  document.documentElement.classList.add('kea-motion')
  last = performance.now()
  raf = window.requestAnimationFrame(loop)
}

export function stopKeaAnimationEngine() {
  running = false
  if (raf) window.cancelAnimationFrame(raf)
  raf = 0
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
