import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { requestClearTalkAndSoftReset } from '../../architecture/keaTalkMemory'
import { useHoldKeaListening } from '../../architecture/keaUiHold'
import {
  formatTrendPercent,
  getTalkTrendPercent,
  TALK_PERFORMANCE_EVENT,
} from '../../architecture/keaTalkPerformance'
import { dismissSpokenTour } from '../../data/keaOnboarding'
import { useSession } from '../../context/SessionContext'
import type { SkyTheme } from '../../types'
import { KeaMark } from './KeaMark'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PwaInstallAttention } from './PwaInstallAttention'
import { UserMenu } from './UserMenu'

function ClearChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65z"
      />
    </svg>
  )
}

function MicPickIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="#2f6cff" />
      <path
        fill="none"
        stroke="#c44bff"
        strokeWidth="2"
        strokeLinecap="round"
        d="M6.2 11.2a5.8 5.8 0 0 0 11.6 0"
      />
      <path
        fill="#ffe14a"
        d="M11.15 18.2h1.7v2.6h-1.7z"
      />
      <path
        fill="none"
        stroke="#ffe14a"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M8.4 21.2h7.2"
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

/** Sun = switch to light (clouds); moon = switch to night. */
function ThemeIcon({ mode }: { mode: 'light' | 'dark' }) {
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="#f0e6ff"
          d="M12.1 3.1a8.9 8.9 0 1 0 8.8 10.4 7.1 7.1 0 0 1-8.8-10.4z"
        />
        <circle cx="17.2" cy="7.1" r="1.05" fill="#ffe14a" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="#ffe14a" />
      <g stroke="#ffb15a" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6l1.6-1.6M17 7l1.6-1.6" />
      </g>
    </svg>
  )
}

interface CompanionNavProps {
  /** Quiet typing mode: no microphone and no spoken replies. */
  textMode?: boolean
  onToggleTextMode?: () => void
  /** Opens the speaker / headphones / Bluetooth input picker. */
  onOpenAudioRoute?: () => void
}

export function CompanionNav({
  textMode = false,
  onToggleTextMode,
  onOpenAudioRoute,
}: CompanionNavProps) {
  const { email, firstName, skyTheme, setProfile } = useSession()
  const [clearOpen, setClearOpen] = useState(false)
  const [trend, setTrend] = useState(() => getTalkTrendPercent())
  const resetArmedAt = useRef(0)
  useHoldKeaListening(clearOpen)
  const isNight = skyTheme === 'night'

  function toggleTheme() {
    setProfile({
      skyTheme: (isNight ? 'clouds' : 'night') as SkyTheme,
    })
  }

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
    const now = Date.now()
    if (now - resetArmedAt.current < 700) return
    resetArmedAt.current = now
    const userKey = email.trim().toLowerCase() || firstName.trim().toLowerCase()
    dismissSpokenTour(userKey)
    setClearOpen(false)
    // Stay inside the tap gesture — deferring breaks location changes on mobile/PWA.
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
        <div className="companion-nav__tools">
          <PwaInstallAttention />
        </div>
        <div className="companion-nav__cluster">
        <button
          type="button"
          className="companion-nav__icon companion-nav__theme"
          aria-label={isNight ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isNight ? 'Light theme' : 'Dark theme'}
          aria-pressed={isNight}
          onClick={toggleTheme}
        >
          <ThemeIcon mode={isNight ? 'light' : 'dark'} />
        </button>
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
        {onOpenAudioRoute ? (
          <button
            type="button"
            className="companion-nav__icon companion-nav__mic-pick"
            aria-label="Choose microphone and speakers"
            title="Audio input / output"
            onClick={onOpenAudioRoute}
          >
            <MicPickIcon />
            <span className="corner-tip" role="tooltip">
              Pick phone speaker, headphones, or Bluetooth so Kea uses the right
              microphone.
            </span>
          </button>
        ) : null}
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
        <button
          type="button"
          className="companion-nav__icon companion-nav__clear"
          aria-label="Reset Kea"
          onClick={() => setClearOpen(true)}
        >
          <ClearChatIcon />
        </button>
      </div>
      {clearOpen ? (
        <div
          className="kea-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kea-clear-chat-title"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setClearOpen(false)
          }}
        >
          <div
            className="kea-confirm__card"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <p id="kea-clear-chat-title" className="kea-confirm__title">
              Clear this chat and reset Kea?
            </p>
            <p className="kea-confirm__note">
              Clears the screen, skips How to use Kea if it is open, says
              welcome, and Kea starts listening. You stay signed in.
            </p>
            <div className="kea-confirm__actions">
              <button
                type="button"
                className="kea-button kea-button--ghost"
                onClick={() => setClearOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kea-button"
                onPointerUp={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  confirmClear()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  confirmClear()
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
