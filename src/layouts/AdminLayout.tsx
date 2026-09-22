import { NavLink, Outlet } from 'react-router-dom'
import { FUTURE_ADMIN_EMAIL } from '../data/placeholders'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/vocabulary', label: 'Vocabulary', end: false },
  { to: '/admin/settings', label: 'System Settings', end: false },
]

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <header className="admin-topnav">
        <p className="admin-topnav__brand">KEA Admin</p>
        <p className="admin-topnav__meta">Placeholder · {FUTURE_ADMIN_EMAIL}</p>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          <nav aria-label="Admin">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="admin-content">
          <Outlet />
        </section>
      </div>
    </div>
  )
}
