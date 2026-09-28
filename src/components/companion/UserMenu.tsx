import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { useStickyMenu } from '../../hooks/useStickyMenu'

export function UserMenu() {
  const { firstName, email, photoDataUrl, isAdmin, isSignedIn, signOut } =
    useSession()
  const navigate = useNavigate()
  const { rootRef, open, setOpen, onPointerLeave } = useStickyMenu()

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
    <div className="user-menu" ref={rootRef} onPointerLeave={onPointerLeave}>
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
      {open ? (
        <div
          className="user-menu__dropdown"
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <p className="user-menu__email">{email}</p>
          <button type="button" role="menuitem" onClick={goSettings}>
            Settings
          </button>
          <Link
            role="menuitem"
            to="/subscription"
            onClick={() => setOpen(false)}
          >
            Subscription
          </Link>
          <Link role="menuitem" to="/support" onClick={() => setOpen(false)}>
            Customer Support
          </Link>
          <Link role="menuitem" to="/about" onClick={() => setOpen(false)}>
            About
          </Link>
          {isAdmin ? (
            <Link
              role="menuitem"
              to="/conversation?onboarding=1"
              onClick={() => setOpen(false)}
            >
              Onboarding
            </Link>
          ) : null}
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
