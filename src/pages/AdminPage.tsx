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
import {
  DEFAULT_KEA_MASTER_DEFINITION,
  getMasterDefinition,
  resetMasterDefinition,
  saveMasterDefinition,
} from '../data/keaMasterDefinition'
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
          <NavLink to="/admin/about">About Kea</NavLink>
          <NavLink to="/admin/costs">Cost analysis</NavLink>
          <NavLink to="/admin/offers">Offers</NavLink>
          <NavLink to="/admin/leave-funnel">Leave funnel</NavLink>
          <NavLink to="/admin" end>
            Overview
          </NavLink>
          <NavLink to="/admin/tiers">Tiers</NavLink>
          <NavLink to="/admin/voice-management">Voice Management</NavLink>
          <NavLink to="/admin/voices">Voice Tester</NavLink>
          <NavLink to="/admin/website-tracker">Website Tracker</NavLink>
        </nav>
        <Outlet />
      </div>
    </main>
  )
}

export function AdminOverview() {
  const [definition, setDefinition] = useState(getMasterDefinition)
  const [saved, setSaved] = useState(false)
  const [voice, setVoice] = useState<VoiceDiagnostics>(getVoiceDiagnostics)

  useEffect(() => subscribeVoiceDiagnostics(setVoice), [])

  return (
    <>
      <section className="settings-card">
        <h2>Models and methods</h2>
        <p className="settings-note">
          What Kea actually uses today. Live recognition on this device is
          listed under Voice diagnostics.
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
              OpenAI TTS (/api/tts) and browser speechSynthesis, chosen in Voice
              Management
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
      <section className="settings-card">
        <h2>Kea Master Definition</h2>
        <p className="settings-note">
          Source of truth for how Kea talks. Saved edits are used in live
          conversation.
        </p>
        <textarea
          className="master-definition"
          value={definition}
          onChange={(event) => {
            setDefinition(event.target.value)
            setSaved(false)
          }}
          spellCheck={false}
        />
        <div className="welcome-screen__actions">
          <button
            type="button"
            className="kea-button"
            onClick={() => {
              saveMasterDefinition(definition)
              setSaved(true)
            }}
          >
            {saved ? 'Saved' : 'Save definition'}
          </button>
          <button
            type="button"
            className="kea-button kea-button--ghost"
            onClick={() => {
              resetMasterDefinition()
              setDefinition(DEFAULT_KEA_MASTER_DEFINITION)
              setSaved(true)
            }}
          >
            Restore original
          </button>
        </div>
      </section>
    </>
  )
}
