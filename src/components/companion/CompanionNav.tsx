import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { requestClearTalkAndSoftReset } from '../../architecture/keaTalkMemory'
import { KeaMark } from './KeaMark'
import { UserMenu } from './UserMenu'

const LINKS = [
  { to: '/conversation', label: 'Chat' },
  { to: '/learn', label: 'Learn List' },
  { to: '/topics', label: 'Topics' },
] as const

function ClearChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.2 12a7.8 7.8 0 0 1 13.3-5.5L20 8.4M19.8 12a7.8 7.8 0 0 1-13.3 5.5L4 15.6M20 4.2v4.2h-4.2M4 19.8v-4.2h4.2"
      />
    </svg>
  )
}

interface CompanionNavProps {
  /** Optional mic name shown under the profile avatar (admin chat). */
  micLabel?: string
}

export function CompanionNav({ micLabel = '' }: CompanionNavProps) {
  const [clearOpen, setClearOpen] = useState(false)

  function confirmClear() {
    setClearOpen(false)
    requestClearTalkAndSoftReset()
  }

  return (
    <>
      <nav className="companion-nav" aria-label="Kea">
        <Link to="/conversation" className="companion-nav__mark" aria-label="Kea home">
          <KeaMark className="kea-mark--header" />
        </Link>
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `memory-button${isActive ? ' is-active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
        <button
          type="button"
          className="companion-nav__clear"
          aria-label="Clear chat"
          title="Clear chat"
          onClick={() => setClearOpen(true)}
        >
          <ClearChatIcon />
        </button>
        <UserMenu micLabel={micLabel} />
      </nav>
      {clearOpen ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-clear-chat-title"
          onClick={() => setClearOpen(false)}
        >
          <div
            className="kea-confirm__card"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-clear-chat-title" className="kea-confirm__title">
              Clear this chat and reset Kea?
            </p>
            <p className="kea-confirm__note">
              Stops listening and speech. You stay signed in.
            </p>
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button kea-button--ghost"
                onClick={() => setClearOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="kea-button" onClick={confirmClear}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
