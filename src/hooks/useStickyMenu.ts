import { useEffect, useRef, useState, type PointerEvent } from 'react'

/**
 * A menu that stays open while the pointer is on it.
 * Closes on outside press (mouse/touch), pointer leave, or Escape.
 * Choosing an item is the caller's job.
 */
export function useStickyMenu() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointerDown(event: Event) {
      const root = rootRef.current
      if (!root) return
      const target = event.target
      if (target instanceof Node && root.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // Capture so a tap outside closes before another control eats the gesture.
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open])

  function onPointerLeave(event: PointerEvent<HTMLElement>) {
    const root = rootRef.current
    if (!root) return
    const next = event.relatedTarget
    if (next instanceof Node && root.contains(next)) return
    // A native option list is outside the page. Leaving into it reports no target.
    if (next == null) return
    setOpen(false)
  }

  return { rootRef, open, setOpen, onPointerLeave }
}
