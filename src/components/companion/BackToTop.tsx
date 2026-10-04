import { useEffect, useState } from 'react'

function scrollRoot(): HTMLElement | Window {
  return (
    document.querySelector<HTMLElement>('.method-screen__content') ?? window
  )
}

function scrollTopOf(target: HTMLElement | Window): number {
  return target instanceof Window ? target.scrollY : target.scrollTop
}

/** Simple ↑ control for long marketing pages. */
export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = scrollRoot()
    const onScroll = () => {
      setVisible(scrollTopOf(target) > 420)
    }
    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={() => {
        const target = scrollRoot()
        if (target instanceof Window) {
          target.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          target.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 19V5M6 11l6-6 6 6"
        />
      </svg>
    </button>
  )
}
