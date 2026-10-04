/**
 * LOCKED chrome — Method / Learn more header (same as marketing home).
 * Ask before changing. See `.cursor/rules/method-learn-chrome-lock.mdc`.
 */
import { Link, NavLink } from 'react-router-dom'

/** Same top bar as marketing home: logo + Home / The Method / Login. */
export function MarketingSiteHeader() {
  return (
    <header className="welcome-screen__header method-screen__top">
      <Link to="/" className="method-screen__brand" aria-label="Kea home">
        <img
          className="method-screen__logo"
          src="/kea-mark.png"
          alt="Kea"
          width={180}
          height={90}
          fetchPriority="high"
        />
      </Link>
      <nav className="method-screen__nav" aria-label="Site">
        <NavLink to="/" end className="method-screen__home">
          Home
        </NavLink>
        <NavLink to="/method" className="method-screen__page-title">
          The Method
        </NavLink>
        <Link
          to="/?login=1"
          className="method-screen__page-title method-screen__login"
        >
          Login
        </Link>
      </nav>
    </header>
  )
}
