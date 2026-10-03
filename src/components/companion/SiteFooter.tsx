import { Link } from 'react-router-dom'

/** Legal links for the public website footer. */
export function SiteFooter({
  tone = 'marketing',
}: {
  tone?: 'marketing' | 'plain'
}) {
  return (
    <footer
      className={`site-footer${tone === 'plain' ? ' site-footer--plain' : ''}`}
    >
      <nav className="site-footer__nav" aria-label="Site">
        <Link to="/what-is-kea">What is Kea</Link>
        <Link to="/method">The Method</Link>
        <Link to="/support">Support</Link>
        <Link to="/privacy-policy">Privacy</Link>
        <Link to="/terms-of-service">Terms of Service</Link>
        <Link to="/cookie-policy">Cookies</Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <p className="site-footer__copy">© {new Date().getFullYear()} Kea</p>
    </footer>
  )
}
