import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'

const SUPPORT_EMAIL = 'team@kea.chat'

/**
 * Public customer support page for Play Store and in-app help.
 * https://kea.chat/support
 */
export function SupportPage() {
  return (
    <main className="companion-screen legal-screen">
      <CloudAtmosphere presence="idle" />
      <div className="legal-screen__content">
        <div className="settings-title-row">
          <h1>Customer Support</h1>
          <Link to="/" className="settings-close" aria-label="Back to Kea">
            ×
          </Link>
        </div>
        <article className="settings-card legal-doc support-doc">
          <p className="legal-doc__updated">Kea · kea.chat</p>
          <h2>We’re here to help</h2>
          <p>
            If something isn’t working, you have a question about your account or
            subscription, or you’d like to tell us how Kea could be better, email
            us.
          </p>
          <p>
            <a className="support-doc__mail" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>
            We read every message and usually reply within a couple of working
            days. Please include the email on your Kea account and a short
            description of what you need — screenshots help when something looks
            wrong on screen.
          </p>
          <h2>Account and data</h2>
          <p>
            To delete your Kea account and data, use{' '}
            <Link to="/delete-account">Delete my Kea data</Link>, or open
            Settings → Security in the app.
          </p>
          <h2>In the app</h2>
          <p>
            Signed-in users can also open this page from the account menu →
            Customer Support, or from Settings.
          </p>
          <p>
            <Link className="support-doc__chat" to="/conversation">
              Back to chat
            </Link>
          </p>
        </article>
        <SiteFooter tone="plain" />
      </div>
    </main>
  )
}
