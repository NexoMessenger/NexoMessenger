import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import { Avatar } from './ui'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/translations'

const NAV: { to: string; labelKey: TranslationKey; icon: string }[] = [
  { to: '/chats', labelKey: 'nav.chats', icon: '💬' },
  { to: '/groups', labelKey: 'nav.groups', icon: '👥' },
  { to: '/channels', labelKey: 'nav.channels', icon: '📣' },
  { to: '/search', labelKey: 'nav.search', icon: '⌕' },
  { to: '/profile', labelKey: 'nav.profile', icon: '◯' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { t } = useI18n()
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
          <span>{t(n.labelKey)}</span>
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
            <span>{t('banner.demo')}</span>
          </div>
        )}
        {children}
      </div>
      <nav className="bottom-nav">{items('mobile')}</nav>
    </div>
  )
}
