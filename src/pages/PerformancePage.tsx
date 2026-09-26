import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { CompanionNav } from '../components/companion/CompanionNav'
import { PerformancePanel } from '../components/companion/PerformancePanel'

export function PerformancePage() {
  return (
    <main className="companion-screen memory-library performance-page">
      <CloudAtmosphere presence="idle" />
      <header className="memory-library__header">
        <CompanionNav />
      </header>
      <div className="memory-library__content">
        <h1>Performance</h1>
        <PerformancePanel />
      </div>
    </main>
  )
}
