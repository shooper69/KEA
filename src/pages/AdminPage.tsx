import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import {
  getVoiceDiagnostics,
  subscribeVoiceDiagnostics,
  type VoiceDiagnostics,
} from '../architecture/voiceDiagnostics'
import { useSession } from '../context/SessionContext'
import { PLACEHOLDER_USERS } from '../data/placeholders'

export function AdminPage() {
  const { isAdmin } = useSession()

  if (!isAdmin) {
    return <Navigate to="/settings" replace />
  }

  return (
    <main className="companion-screen settings-screen admin-screen">
      <CloudAtmosphere presence="idle" />
      <header className="settings-screen__header">
        <CompanionNav />
      </header>
      <div className="settings-screen__content admin-screen__content">
        <div className="settings-title-row">
          <h1>Admin</h1>
          <Link to="/conversation" className="settings-close" aria-label="Close admin">
            ×
          </Link>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          <NavLink to="/admin/costs">Cost analysis</NavLink>
          <NavLink to="/admin/home">Home page</NavLink>
          <NavLink to="/admin/leave-funnel">Leave funnel</NavLink>
          <NavLink to="/admin/manage-kea">Manage Kea</NavLink>
          <NavLink to="/admin/offers">Offers</NavLink>
          <NavLink to="/admin/onboarding">Onboarding</NavLink>
          <NavLink to="/admin" end>
            Overview
          </NavLink>
          <NavLink to="/admin/stripe">Stripe</NavLink>
          <NavLink to="/admin/tiers">Subscription</NavLink>
          <NavLink to="/admin/website-tracker">Website Tracker</NavLink>
        </nav>
        <Outlet />
      </div>
    </main>
  )
}

export function AdminOverview() {
  const [voice, setVoice] = useState<VoiceDiagnostics>(getVoiceDiagnostics)

  useEffect(() => subscribeVoiceDiagnostics(setVoice), [])

  return (
    <>
      <section className="settings-card">
        <h2>Models and methods</h2>
        <p className="settings-note">
          What Kea actually uses today. Live recognition on this device is
          listed under Voice diagnostics. Character, style, and voices are
          edited in Manage Kea.
        </p>
        <dl className="voice-diag">
          <div>
            <dt>Speech to text</dt>
            <dd>OpenAI Whisper (whisper-1) via /api/transcribe</dd>
          </div>
          <div>
            <dt>Language model</dt>
            <dd>OpenAI gpt-4o-mini via /api/chat</dd>
          </div>
          <div>
            <dt>Text to speech</dt>
            <dd>
              OpenAI TTS (/api/tts) and browser speechSynthesis, chosen in Manage
              Kea
            </dd>
          </div>
          <div>
            <dt>Not in use</dt>
            <dd>
              Browser SpeechRecognition, OpenAI Realtime, Deepgram, Azure Speech
            </dd>
          </div>
        </dl>
      </section>
      <section className="settings-card">
        <h2>Voice diagnostics</h2>
        <p className="settings-note">
          Development only. Live values from the last conversation on this
          device.
        </p>
        <dl className="voice-diag">
          <div>
            <dt>Speech Recognition Available</dt>
            <dd>{voice.recognitionAvailable ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Recognition Running</dt>
            <dd>{voice.recognitionRunning ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt>Recognition Language</dt>
            <dd>{voice.recognitionLanguage || '—'}</dd>
          </div>
          <div>
            <dt>Last Transcript</dt>
            <dd>{voice.lastTranscript || '—'}</dd>
          </div>
          <div>
            <dt>Last Whisper confidence</dt>
            <dd>
              {voice.lastConfidence
                ? `${Math.round(voice.lastConfidence * 100)}%`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Last Recognition Error</dt>
            <dd>{voice.lastRecognitionError || '—'}</dd>
          </div>
          <div>
            <dt>Last AI Response</dt>
            <dd>{voice.lastAiResponse || '—'}</dd>
          </div>
          <div>
            <dt>Last Speech Output</dt>
            <dd>{voice.lastSpeechOutput || '—'}</dd>
          </div>
        </dl>
        {voice.updatedAt ? (
          <p className="settings-note">
            Updated {new Date(voice.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </section>
      <div className="admin-stat-grid">
        <article className="settings-card">
          <h2>Users</h2>
          <p>{PLACEHOLDER_USERS.length}</p>
        </article>
      </div>
    </>
  )
}
