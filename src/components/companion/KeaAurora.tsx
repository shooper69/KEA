import { useEffect, useRef } from 'react'
import { subscribeKeaMotion } from '../../architecture/keaAnimationEngine'

const BLOBS = [
  { x: 0.22, y: 0.28, r: 0.42, color: [120, 190, 255], a: 0.22, sx: 0.07, sy: 0.05, p: 0.4 },
  { x: 0.72, y: 0.32, r: 0.38, color: [255, 170, 210], a: 0.18, sx: 0.05, sy: 0.07, p: 1.1 },
  { x: 0.5, y: 0.62, r: 0.48, color: [90, 220, 190], a: 0.16, sx: 0.06, sy: 0.04, p: 2.2 },
  { x: 0.18, y: 0.7, r: 0.36, color: [255, 210, 120], a: 0.15, sx: 0.04, sy: 0.06, p: 3.0 },
  { x: 0.82, y: 0.68, r: 0.4, color: [170, 140, 255], a: 0.17, sx: 0.055, sy: 0.045, p: 3.8 },
  { x: 0.48, y: 0.18, r: 0.32, color: [80, 160, 255], a: 0.14, sx: 0.03, sy: 0.05, p: 4.6 },
]

export function KeaAurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    const backingScale = () => {
      const large = window.matchMedia('(min-width: 721px)').matches
      if (large) return 0.5
      return Math.min(1.5, window.devicePixelRatio || 1)
    }

    const fit = () => {
      const parent = canvas.parentElement
      const width = parent?.clientWidth || window.innerWidth
      const height = parent?.clientHeight || window.innerHeight
      const scale = backingScale()
      canvas.width = Math.max(1, Math.floor(width * scale))
      canvas.height = Math.max(1, Math.floor(height * scale))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(scale, 0, 0, scale, 0, 0)
    }

    fit()
    const observer = new ResizeObserver(fit)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    const unsubscribe = subscribeKeaMotion((time) => {
      const parent = canvas.parentElement
      const width = parent?.clientWidth || window.innerWidth
      const height = parent?.clientHeight || window.innerHeight
      context.clearRect(0, 0, width, height)
      const t = time / 1000
      context.globalCompositeOperation = 'lighter'
      for (const blob of BLOBS) {
        const x =
          (blob.x + Math.sin(t * blob.sx + blob.p) * 0.08 + Math.sin(t * 0.11 + blob.p) * 0.03) *
          width
        const y =
          (blob.y + Math.cos(t * blob.sy + blob.p * 0.7) * 0.07 + Math.cos(t * 0.09 + blob.p) * 0.025) *
          height
        const radius = blob.r * Math.max(width, height) * (0.92 + Math.sin(t * 0.08 + blob.p) * 0.08)
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        const [r, g, b] = blob.color
        const pulse = blob.a * (0.82 + Math.sin(t * 0.13 + blob.p) * 0.18)
        gradient.addColorStop(0, `rgba(${r},${g},${b},${pulse})`)
        gradient.addColorStop(0.45, `rgba(${r},${g},${b},${pulse * 0.35})`)
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
        context.fillStyle = gradient
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }
      context.globalCompositeOperation = 'source-over'
      const mist = context.createLinearGradient(0, 0, width, height)
      const drift = (Math.sin(t * 0.04) + 1) / 2
      mist.addColorStop(0, `rgba(180, 220, 255, ${0.05 + drift * 0.04})`)
      mist.addColorStop(0.5, `rgba(255, 210, 230, ${0.04 + (1 - drift) * 0.03})`)
      mist.addColorStop(1, `rgba(160, 230, 210, ${0.05 + drift * 0.03})`)
      context.fillStyle = mist
      context.fillRect(0, 0, width, height)
    })

    return () => {
      unsubscribe()
      observer.disconnect()
    }
  }, [])

  return <canvas className="kea-aurora" ref={canvasRef} aria-hidden="true" />
}
