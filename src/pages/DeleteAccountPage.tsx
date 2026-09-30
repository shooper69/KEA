import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { DeleteAccountPanel } from '../components/companion/DeleteAccountPanel'
import { SiteFooter } from '../components/companion/SiteFooter'

/**
 * Public account-deletion URL for Google Play and self-serve privacy requests.
 * https://kea.chat/delete-account
 */
export function DeleteAccountPage() {
  return (
    <main className="companion-screen legal-screen">
      <CloudAtmosphere presence="idle" />
      <div className="legal-screen__content">
        <div className="settings-title-row">
          <h1>Delete my Kea data</h1>
          <Link to="/" className="settings-close" aria-label="Back to Kea">
            ×
          </Link>
        </div>
        <DeleteAccountPanel showSettingsLink />
        <SiteFooter tone="plain" />
      </div>
    </main>
  )
}
