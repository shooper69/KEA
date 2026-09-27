import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { keaRestartUrl, requestClearTalkAndSoftReset } from '../../architecture/keaTalkMemory'
import {
  formatTrendPercent,
  getTalkTrendPercent,
  TALK_PERFORMANCE_EVENT,
} from '../../architecture/keaTalkPerformance'
import { useSession } from '../../context/SessionContext'
import { KeaMark } from './KeaMark'
import { LanguageSwitcher } from './LanguageSwitcher'
import { UserMenu } from './UserMenu'

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

function TypeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"
      />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16.5 9.2 11l3.3 3.2L20 6.5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        d="M14.5 6.5H20v5.5"
      />
    </svg>
  )
}

interface CompanionNavProps {
  /** Optional mic name shown under the profile avatar (admin chat). */
  micLabel?: string
  /** Quiet typing mode: no microphone and no spoken replies. */
  textMode?: boolean
  onToggleTextMode?: () => void
}

export function CompanionNav({
  micLabel = '',
  textMode = false,
  onToggleTextMode,
}: CompanionNavProps) {
  const { isAdmin } = useSession()
  const [clearOpen, setClearOpen] = useState(false)
  const [trend, setTrend] = useState(() => getTalkTrendPercent())

  useEffect(() => {
    const refresh = () => setTrend(getTalkTrendPercent())
    refresh()
    window.addEventListener(TALK_PERFORMANCE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TALK_PERFORMANCE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  function confirmClear() {
    setClearOpen(false)
    requestClearTalkAndSoftReset()
  }

  const trendLabel = formatTrendPercent(trend)
  const trendUp = trend > 0
  const trendDown = trend < 0

  return (
    <>
      <nav className="companion-nav" aria-label="Kea">
        <Link to="/conversation" className="companion-nav__mark" aria-label="Kea home">
          <KeaMark className="kea-mark--header" />
        </Link>
        <LanguageSwitcher />
        <NavLink
          to="/conversation"
          className={({ isActive }) =>
            `memory-button${isActive ? ' is-active' : ''}`
          }
        >
          Chat
        </NavLink>
        <NavLink
          to="/learn"
          className={({ isActive }) =>
            `memory-button${isActive ? ' is-active' : ''}`
          }
        >
          Learn List
        </NavLink>
        {isAdmin ? (
          <NavLink
            to="/topics"
            className={({ isActive }) =>
              `memory-button memory-button--wip${isActive ? ' is-active' : ''}`
            }
            title="Topics (work in progress)"
          >
            Topics
          </NavLink>
        ) : (
          <NavLink
            to="/performance"
            className={({ isActive }) =>
              `perf-badge${isActive ? ' is-active' : ''}${
                trendUp ? ' perf-badge--up' : ''
              }${trendDown ? ' perf-badge--down' : ''}`
            }
            aria-label={`Performance ${trendLabel} over seven days`}
            title={`Seven-day talk trend: ${trendLabel}`}
          >
            <TrendIcon />
            <span className="perf-badge__value">{trendLabel}</span>
          </NavLink>
        )}
        {onToggleTextMode ? (
          <button
            type="button"
            className={`companion-nav__text${textMode ? ' is-on' : ''}`}
            aria-pressed={textMode}
            aria-label={textMode ? 'Switch back to voice' : 'Type instead of speaking'}
            title={textMode ? 'Switch back to voice' : 'Type instead of speaking'}
            onClick={onToggleTextMode}
          >
            <TypeIcon />
          </button>
        ) : null}
        <a
          href={keaRestartUrl()}
          className="companion-nav__clear"
          aria-label="Reset Kea"
          title="Reset Kea"
          onClick={(event) => {
            event.preventDefault()
            setClearOpen(true)
          }}
        >
          <ClearChatIcon />
        </a>
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
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
