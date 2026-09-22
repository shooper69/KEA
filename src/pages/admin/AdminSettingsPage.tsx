import { VOCABULARY_MASTERY_THRESHOLD } from '../../architecture/vocabularyMemory'
import { SUPPORTED_LANGUAGES } from '../../config/languages'
import { VOICE_PERSONALITIES } from '../../config/voices'
import { FUTURE_ADMIN_EMAIL } from '../../data/placeholders'

export function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <h1>System Settings</h1>
      <p className="admin-page__lede">
        Placeholder configuration. Auth, roles, and live providers are not
        connected.
      </p>

      <section className="admin-panel">
        <h2>Admin</h2>
        <p>Future admin email: {FUTURE_ADMIN_EMAIL}</p>
      </section>

      <section className="admin-panel">
        <h2>Languages</h2>
        <ul>
          {SUPPORTED_LANGUAGES.map((language) => (
            <li key={language.code}>
              {language.name} ({language.nativeName})
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2>Voice personalities</h2>
        <p>Selection is not implemented.</p>
        <ul>
          {VOICE_PERSONALITIES.map((voice) => (
            <li key={voice.id}>
              {voice.label} — {voice.description}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-panel">
        <h2>Vocabulary memory</h2>
        <p>Mastery threshold: {VOCABULARY_MASTERY_THRESHOLD} successful uses.</p>
      </section>
    </div>
  )
}
