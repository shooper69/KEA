import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'
import { DISCOVERY_CONTACT } from '../seo/keaDiscovery'

export function ContactPage() {
  return (
    <main className="companion-screen legal-screen">
      <CloudAtmosphere presence="idle" />
      <div className="legal-screen__content">
        <div className="settings-title-row">
          <h1>Contact</h1>
          <Link to="/" className="settings-close" aria-label="Close">
            ×
          </Link>
        </div>
        <article className="settings-card legal-doc support-doc">
          <p>Email Kea at</p>
          <p>
            <a className="support-doc__mail" href={`mailto:${DISCOVERY_CONTACT}`}>
              {DISCOVERY_CONTACT}
            </a>
          </p>
          <p>
            For help with an account or subscription, see{' '}
            <Link to="/support">Customer Support</Link>. Read{' '}
            <Link to="/what-is-kea">What is Kea</Link> or{' '}
            <Link to="/method">The Method</Link>.
          </p>
        </article>
      </div>
      <SiteFooter tone="plain" />
    </main>
  )
}
