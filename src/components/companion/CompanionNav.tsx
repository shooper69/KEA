import { NavLink } from 'react-router-dom'
import { UserMenu } from './UserMenu'

const LINKS = [
  { to: '/conversation', label: 'Talk' },
  { to: '/learn', label: 'Learn List' },
  { to: '/topics', label: 'Topics' },
] as const

export function CompanionNav() {
  return (
    <nav className="companion-nav" aria-label="Kea">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `memory-button${isActive ? ' is-active' : ''}`
          }
        >
          {link.label}
        </NavLink>
      ))}
      <UserMenu />
    </nav>
  )
}
