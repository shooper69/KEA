import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { keaRestartUrl, requestClearTalkAndSoftReset } from '../../architecture/keaTalkMemory'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
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
        fill="#111111"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65z"
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
        d="M1.4 1.6h11.4a2.3 2.3 0 0 1 2.3 2.3v6.4a2.3 2.3 0 0 1-2.3 2.3H8.6L3.4 20.2V12.6H3.7a2.3 2.3 0 0 1-2.3-2.3V3.9a2.3 2.3 0 0 1 2.3-2.3z"
      />
      <path
        fill="#c44bff"
        d="M8.2 6.2h12.2a2.3 2.3 0 0 1 2.3 2.3v5.6a2.3 2.3 0 0 1-2.3 2.3h-2.4l3.2 6.4-5.4-6.4H10.5a2.3 2.3 0 0 1-2.3-2.3V8.5a2.3 2.3 0 0 1 2.3-2.3z"
      />
    </svg>
  )
}

function BookIcon() {
  return (
    <img
      className="companion-nav__learn"
      src="/learn-list-books.png?v=2"
      alt=""
    />
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
  useHoldKeaListening(clearOpen)

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
        <div className="companion-nav__cluster">
        <LanguageSwitcher />
        {onToggleTextMode ? null : (
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
        </div>
      </nav>
      <div className="companion-corner">
        {onToggleTextMode ? (
          <button
            type="button"
            className="companion-nav__icon companion-nav__text"
            aria-pressed={textMode}
            aria-label={textMode ? 'Back to chat' : 'Type instead of speaking'}
            onClick={onToggleTextMode}
          >
            {textMode ? <ChatIcon /> : <KeyboardIcon />}
            <span className="corner-tip" role="tooltip">
              {textMode
                ? 'Leave typing and go back to speaking with Kea.'
                : 'Type your message instead of speaking. Press Enter and Kea answers aloud.'}
            </span>
          </button>
        ) : null}
        <a
          href={keaRestartUrl()}
          className="companion-nav__icon companion-nav__clear"
          aria-label="Reset Kea"
          onClick={(event) => {
            event.preventDefault()
            setClearOpen(true)
          }}
        >
          <ClearChatIcon />
          <span className="corner-tip" role="tooltip">
            Clears the screen, says welcome, and Kea starts listening. You stay signed in.
          </span>
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
              Clears the screen, says welcome, and Kea starts listening. You stay signed in.
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
