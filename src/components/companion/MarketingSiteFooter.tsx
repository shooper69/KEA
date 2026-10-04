/**
 * LOCKED chrome — Method / Learn more footer (same marketing home bar).
 * Ask before changing. See `.cursor/rules/method-learn-chrome-lock.mdc`.
 */
import { SiteFooter } from './SiteFooter'
import { StoreBadges } from './StoreBadges'

/** Same store badges + legal bar as marketing home (no comments strip). */
export function MarketingSiteFooter() {
  return (
    <footer className="welcome-screen__store-footer method-screen__store-footer">
      <div className="welcome-screen__store-footer-bar">
        <StoreBadges />
        <SiteFooter tone="marketing" />
      </div>
    </footer>
  )
}
