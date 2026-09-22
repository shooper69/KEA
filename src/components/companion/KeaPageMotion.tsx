import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { keaEaseOut, subscribeKeaMotion } from '../../architecture/keaAnimationEngine'

export function KeaPageMotion({ children }: { children: ReactNode }) {
  const location = useLocation()
  const nodeRef = useRef<HTMLDivElement>(null)
  const motionKey = location.pathname.startsWith('/admin')
    ? '/admin'
    : location.pathname

  useLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return
    node.style.opacity = '0'
    node.style.transform = 'translate3d(0, 16px, 0)'
    const began = performance.now()
    const stop = subscribeKeaMotion((now) => {
      const t = keaEaseOut((now - began) / 520)
      node.style.opacity = String(t)
      node.style.transform = `translate3d(0, ${(1 - t) * 16}px, 0)`
      if (t >= 1) {
        node.style.opacity = '1'
        node.style.transform = 'none'
        stop()
      }
    })
    return stop
  }, [motionKey])

  return (
    <div className="kea-page" ref={nodeRef}>
      {children}
    </div>
  )
}
