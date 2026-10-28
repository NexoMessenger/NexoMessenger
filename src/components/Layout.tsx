import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import { Avatar } from './ui'

const NAV = [
  { to: '/chats', label: 'Chats', icon: '💬' },
  { to: '/groups', label: 'Groups', icon: '👥' },
  { to: '/channels', label: 'Channels', icon: '📣' },
  { to: '/search', label: 'Search', icon: '⌕' },
  { to: '/profile', label: 'Profile', icon: '◯' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!profile) return
    let alive = true
    const load = async () => {
      try {
        const [chats, groups] = await Promise.all([api.listDirectChats(profile.id), api.listGroups(profile.id)])
        if (!alive) return
        setUnread(chats.reduce((s, c) => s + c.unread, 0) + groups.reduce((s, g) => s + g.unread, 0))
      } catch { /* badge is best-effort */ }
    }
    load()
    const unsub = api.subscribeGlobal(load)
    return () => { alive = false; unsub() }
  }, [profile])

  const items = (cls: string) => (
    <>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${cls}`}>
          <span style={{ fontSize: 19, lineHeight: 1 }}>{n.icon}</span>
          <span>{n.label}</span>
          {n.to === '/chats' && unread > 0 && <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo-badge">N</div>
        {items('desktop')}
        <div className="sidebar-spacer" />
        {profile && (
          <NavLink to="/profile" style={{ textDecoration: 'none' }} aria-label="Your profile">
            <Avatar profile={profile} size={42} showOnline />
          </NavLink>
        )}
      </aside>
      <div className="main-area">
        {api.mode === 'local' && (
          <div className="demo-banner" role="note">
            <span>⚠</span>
            <span><strong>Local Demo Mode.</strong> Supabase keys are not configured, so data is stored only in this browser. Add keys from <code>.env.example</code> (see README) for real accounts, cloud sync and Google sign-in.</span>
          </div>
        )}
        {children}
      </div>
      <nav className="bottom-nav">{items('mobile')}</nav>
    </div>
  )
}
