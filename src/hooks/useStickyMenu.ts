import { useEffect, useRef, useState, type PointerEvent } from 'react'

/**
 * A menu that stays open while the pointer is on it.
 * It closes when the pointer moves onto the page outside it, or on Escape.
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
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
