import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { UsagePanel } from '../components/companion/UsagePanel'
import { useSession } from '../context/SessionContext'

export function UsagePage() {
  const { isAdmin } = useSession()

  return (
    <main className="companion-screen settings-screen">
      <CloudAtmosphere presence="idle" />
      <header className="settings-screen__header">
        <CompanionNav />
      </header>
      <div className="settings-screen__content">
        <div className="settings-title-row">
          <h1>Usage</h1>
          <Link
            to="/conversation"
            className="settings-close"
            aria-label="Close usage"
          >
            ×
          </Link>
        </div>
        <UsagePanel isAdmin={isAdmin} />
      </div>
    </main>
  )
}
