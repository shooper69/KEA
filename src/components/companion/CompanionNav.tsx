import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { keaRestartUrl, requestClearTalkAndSoftReset } from '../../architecture/keaTalkMemory'
import {
  formatTrendPercent,
  getTalkTrendPercent,
  TALK_PERFORMANCE_EVENT,
} from '../../architecture/keaTalkPerformance'
import { KeaMark } from './KeaMark'
import { LanguageSwitcher } from './LanguageSwitcher'
import { UserMenu } from './UserMenu'

function ClearChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="#ff7a32"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12a7 7 0 0 1 12-5l1.6 1.5"
      />
      <path
        fill="#ff7a32"
        d="M16.2 4.2h4.2V8.4l-2.2-1.8a7.8 7.8 0 0 0-1.2-.6L16.2 4.2z"
      />
      <path
        fill="none"
        stroke="#14b8a6"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12a7 7 0 0 1-12 5l-1.6-1.5"
      />
      <path
        fill="#14b8a6"
        d="M7.8 19.8H3.6V15.6l2.2 1.8c.4.25.8.45 1.2.6l.8 1.8z"
      />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="1.2" y="5" width="21.6" height="14" rx="2.4" fill="#3b6cff" />
      <rect x="3" y="7.1" width="2.15" height="2" rx="0.35" fill="#ffe14a" />
      <rect x="5.7" y="7.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="8.4" y="7.1" width="2.15" height="2" rx="0.35" fill="#7dffb2" />
      <rect x="11.1" y="7.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="13.8" y="7.1" width="2.15" height="2" rx="0.35" fill="#ff8ad4" />
      <rect x="16.5" y="7.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="19" y="7.1" width="1.7" height="2" rx="0.35" fill="#ffb15a" />
      <rect x="3" y="10.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="5.7" y="10.1" width="2.15" height="2" rx="0.35" fill="#7ecbff" />
      <rect x="8.4" y="10.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="11.1" y="10.1" width="2.15" height="2" rx="0.35" fill="#ffe14a" />
      <rect x="13.8" y="10.1" width="2.15" height="2" rx="0.35" fill="#fff" />
      <rect x="16.5" y="10.1" width="2.15" height="2" rx="0.35" fill="#7dffb2" />
      <rect x="19" y="10.1" width="1.7" height="2" rx="0.35" fill="#fff" />
      <rect x="6.2" y="13.2" width="11.6" height="2.15" rx="0.45" fill="#fff" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#2f6cff"
        d="M3.2 4.2h10.2a2.2 2.2 0 0 1 2.2 2.2v5.4a2.2 2.2 0 0 1-2.2 2.2H8.4L5.2 16.8V14H3.2A2.2 2.2 0 0 1 1 11.8V6.4a2.2 2.2 0 0 1 2.2-2.2z"
      />
      <path
        fill="#c44bff"
        d="M9.2 8.2h10.4a2.2 2.2 0 0 1 2.2 2.2v4.6a2.2 2.2 0 0 1-2.2 2.2h-1.1v2.3l-2.8-2.3H9.2a2.2 2.2 0 0 1-2.2-2.2v-4.6a2.2 2.2 0 0 1 2.2-2.2z"
      />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#2f6cff"
        d="M3.2 4.2h7.1c.8 1.15 1.7 1.7 2.9 1.7v13.2c-1.2 0-2.1-.5-2.9-1.55H3.2V4.2z"
      />
      <path
        fill="#b14dff"
        d="M13.2 5.9c1.2 0 2.1-.55 2.9-1.7h4.7v13.35h-4.7c-.8 1.05-1.7 1.55-2.9 1.55V5.9z"
      />
      <path
        fill="#5ce1ff"
        d="M4.6 6.5h5.1v1.15H4.6zm0 2.25h5.1v1.15H4.6zm0 2.25h3.8v1.15H4.6z"
      />
    </svg>
  )
}

function TrendIcon({ tone }: { tone: 'up' | 'down' | 'flat' }) {
  const colour = tone === 'up' ? '#1f9d57' : tone === 'down' ? '#e23b3b' : '#5c6b7a'
  const rising = tone !== 'down'
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke={colour}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={
          rising
            ? 'M3.5 16.5 9 10.8l3.2 3.1L20.2 6.2'
            : 'M3.5 7.5 9 13.2l3.2-3.1L20.2 17.8'
        }
      />
      <path
        fill="none"
        stroke={colour}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={rising ? 'M14.6 6.2H20.2V11.8' : 'M14.6 17.8H20.2V12.2'}
      />
    </svg>
  )
}

interface CompanionNavProps {
  /** Quiet typing mode: no microphone and no spoken replies. */
  textMode?: boolean
  onToggleTextMode?: () => void
}

export function CompanionNav({
  textMode = false,
  onToggleTextMode,
}: CompanionNavProps) {
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
        {textMode && onToggleTextMode ? (
          <button
            type="button"
            className="companion-nav__icon is-active"
            aria-label="Back to chat"
            title="Back to chat"
            onClick={onToggleTextMode}
          >
            <ChatIcon />
          </button>
        ) : (
          <NavLink
            to="/conversation"
            className={({ isActive }) =>
              `companion-nav__icon${isActive ? ' is-active' : ''}`
            }
            aria-label="Chat"
            title="Chat"
          >
            <ChatIcon />
          </NavLink>
        )}
        <NavLink
          to="/learn"
          className={({ isActive }) =>
            `companion-nav__icon${isActive ? ' is-active' : ''}`
          }
          aria-label="Learn list"
          title="Learn list"
        >
          <BookIcon />
        </NavLink>
        <NavLink
          to="/performance"
          className={({ isActive }) =>
            `companion-nav__icon companion-nav__perf${isActive ? ' is-active' : ''}${
              trendUp ? ' is-up' : ''
            }${trendDown ? ' is-down' : ''}`
          }
          aria-label={`Performance ${trendLabel} over seven days`}
          title={`Seven-day talk trend: ${trendLabel}`}
        >
          <TrendIcon tone={trendUp ? 'up' : trendDown ? 'down' : 'flat'} />
          <span className="companion-nav__perf-value">{trendLabel}</span>
        </NavLink>
        <UserMenu />
      </nav>
      <div className="companion-corner">
        {onToggleTextMode && !textMode ? (
          <button
            type="button"
            className="companion-nav__icon companion-nav__text"
            aria-pressed={false}
            aria-label="Type instead of speaking"
            title="Type instead of speaking"
            onClick={onToggleTextMode}
          >
            <KeyboardIcon />
          </button>
        ) : null}
        <a
          href={keaRestartUrl()}
          className="companion-nav__icon companion-nav__clear"
          aria-label="Reset Kea"
          title="Reset Kea"
          onClick={(event) => {
            event.preventDefault()
            setClearOpen(true)
          }}
        >
          <ClearChatIcon />
        </a>
      </div>
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
