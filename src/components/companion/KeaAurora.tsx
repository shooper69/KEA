import { useEffect, useRef } from 'react'
import { subscribeKeaMotion } from '../../architecture/keaAnimationEngine'

const BLOBS = [
  { x: 0.22, y: 0.28, r: 0.42, color: [120, 190, 255], a: 0.08, sx: 0.07, sy: 0.05, p: 0.4 },
  { x: 0.72, y: 0.32, r: 0.38, color: [255, 170, 210], a: 0.07, sx: 0.05, sy: 0.07, p: 1.1 },
  { x: 0.5, y: 0.62, r: 0.48, color: [90, 220, 190], a: 0.06, sx: 0.06, sy: 0.04, p: 2.2 },
  { x: 0.18, y: 0.7, r: 0.36, color: [255, 210, 120], a: 0.05, sx: 0.04, sy: 0.06, p: 3.0 },
  { x: 0.82, y: 0.68, r: 0.4, color: [170, 140, 255], a: 0.07, sx: 0.055, sy: 0.045, p: 3.8 },
  { x: 0.48, y: 0.18, r: 0.32, color: [80, 160, 255], a: 0.06, sx: 0.03, sy: 0.05, p: 4.6 },
]

export function KeaAurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    let lastDraw = 0
    let scrolling = false
    let scrollTimer = 0

    const onScroll = () => {
      scrolling = true
      window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        scrolling = false
      }, 160)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })

    const paint = (time: number) => {
      const parent = canvas.parentElement
      if (!parent) return
      const width = parent.clientWidth
      const height = parent.clientHeight
      if (width < 2 || height < 2) return
      const scale = window.matchMedia('(min-width: 721px)').matches ? 0.4 : 0.5
      const bitmapW = Math.max(1, Math.floor(width * scale))
      const bitmapH = Math.max(1, Math.floor(height * scale))
      if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
        canvas.width = bitmapW
        canvas.height = bitmapH
      }
      context.setTransform(bitmapW / width, 0, 0, bitmapH / height, 0, 0)
      context.clearRect(0, 0, width + 2, height + 2)
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
    }

    const unsubscribe = subscribeKeaMotion((time) => {
      if (scrolling || document.hidden) return
      if (time - lastDraw < 1000 / 12) return
      lastDraw = time
      paint(time)
    })

    return () => {
      unsubscribe()
      document.removeEventListener('scroll', onScroll, true)
      window.clearTimeout(scrollTimer)
    }
  }, [])

  return <canvas className="kea-aurora" ref={canvasRef} aria-hidden="true" />
}
