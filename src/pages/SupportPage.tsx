import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'

const SUPPORT_EMAIL = 'team@kea.chat'

export function SupportPage() {
  return (
    <main className="companion-screen settings-screen">
      <CloudAtmosphere presence="idle" />
      <header className="settings-screen__header">
        <CompanionNav />
      </header>
      <div className="settings-screen__content">
        <div className="settings-title-row">
          <h1>Customer Support</h1>
          <Link
            to="/conversation"
            className="settings-close"
            aria-label="Close support"
          >
            ×
          </Link>
        </div>
        <section className="settings-card">
          <h2>We’re here to help</h2>
          <p className="settings-note">
            If something isn’t working, you have a question about your account or
            subscription, or you’d like to tell us how Kea could be better, we’d
            love to hear from you.
          </p>
          <p className="settings-note">
            Email us at{' '}
            <a className="settings-usage-link" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            . We read every message and usually reply within a couple of working
            days.
          </p>
          <p className="settings-note">
            Please include the email on your Kea account and a short description
            of what you need — screenshots help when something looks wrong on
            screen.
          </p>
        </section>
      </div>
    </main>
  )
}
