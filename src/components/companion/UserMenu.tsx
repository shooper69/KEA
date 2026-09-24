import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'

interface UserMenuProps {
  /** Optional mic name shown under the profile avatar (admin chat). */
  micLabel?: string
}

export function UserMenu({ micLabel = '' }: UserMenuProps) {
  const { firstName, email, photoDataUrl, isAdmin, isSignedIn, signOut } =
    useSession()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const node = menuRef.current
      if (!node) return
      if (event.target instanceof Node && node.contains(event.target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function goSettings() {
    setOpen(false)
    navigate('/settings')
  }

  async function leave() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu__avatar"
        aria-label="Account settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {photoDataUrl ? (
          <img src={photoDataUrl} alt="" />
        ) : (
          <span>{(firstName || 'K').slice(0, 1).toUpperCase()}</span>
        )}
      </button>
      {micLabel ? (
        <p className="user-menu__mic" aria-live="polite" title={micLabel}>
          {micLabel}
        </p>
      ) : null}
      {open ? (
        <div className="user-menu__dropdown" role="menu">
          <p className="user-menu__email">{email}</p>
          <button type="button" role="menuitem" onClick={goSettings}>
            Settings
          </button>
          <Link role="menuitem" to="/about" onClick={() => setOpen(false)}>
            About
          </Link>
          {isAdmin ? (
            <Link
              role="menuitem"
              to="/admin"
              className="user-menu__admin"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          ) : null}
          {isSignedIn ? (
            <button type="button" role="menuitem" onClick={() => void leave()}>
              Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
