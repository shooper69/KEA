import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  getMasteredLearnCount,
  subscribeLearnMemory,
} from '../../architecture/companionMemory'
import { UserMenu } from './UserMenu'

const LINKS = [
  { to: '/conversation', label: 'Talk' },
  { to: '/learn', label: 'Learn List' },
  { to: '/topics', label: 'Topics' },
] as const

function MasteredCount() {
  const [count, setCount] = useState(getMasteredLearnCount)

  useEffect(() => {
    const refresh = () => setCount(getMasteredLearnCount())
    const stop = subscribeLearnMemory(refresh)
    window.addEventListener('kea-learn-memory', refresh)
    return () => {
      stop()
      window.removeEventListener('kea-learn-memory', refresh)
    }
  }, [])

  return (
    <span
      className="learn-grown-badge"
      aria-label={`${count} words you now use with ease`}
    >
      {count}
    </span>
  )
}

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
      <div className="companion-nav__account">
        <UserMenu />
        <MasteredCount />
      </div>
    </nav>
  )
}
