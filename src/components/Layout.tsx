import type { PropsWithChildren } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'ホーム', icon: '⌂' },
  { to: '/library', label: 'ライブラリ', icon: '▤' },
  { to: '/settings', label: '設定', icon: '⚙' },
]

export function Layout({ children }: PropsWithChildren) {
  const location = useLocation()
  const editing = location.pathname.startsWith('/capture/') || location.pathname.startsWith('/notes/')

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Active Reading ホーム">
          <span className="brand-mark" aria-hidden="true">AR</span>
          <span>
            <strong>Active Reading</strong>
            <small>思い出して、行動へ</small>
          </span>
        </Link>
      </header>

      <main className={`page-shell${editing ? ' page-shell--editor' : ''}`}>{children}</main>

      {!editing && (
        <nav className="bottom-nav" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
