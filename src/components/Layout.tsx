import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import { Avatar } from './ui'
import MessagePopups from './MessagePopups'
import { IconChats, IconGroups, IconChannel, IconGift, IconSearch, IconProfile, IconSettings, IconAlert, NexoMark, type IconProps } from './icons'
import type { ComponentType } from 'react'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n/translations'

const NAV: { to: string; labelKey: TranslationKey; icon: ComponentType<IconProps> }[] = [
  { to: '/chats', labelKey: 'nav.chats', icon: IconChats },
  { to: '/groups', labelKey: 'nav.groups', icon: IconGroups },
  { to: '/channels', labelKey: 'nav.channels', icon: IconChannel },
  { to: '/gifts', labelKey: 'nav.gifts', icon: IconGift },
  { to: '/search', labelKey: 'nav.search', icon: IconSearch },
  { to: '/profile', labelKey: 'nav.profile', icon: IconProfile },
  { to: '/settings', labelKey: 'nav.settings', icon: IconSettings },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { t } = useI18n()
  const { pathname } = useLocation()
  // Inside an open conversation the message composer must own the bottom of
  // the screen — the fixed bottom navigation would cover it on mobile.
  const inRoom = pathname === '/ai' || /^\/(chat|group|channel)\//.test(pathname)
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
          {(() => { const NavIcon = n.icon; return <NavIcon size={20} /> })()}
          <span>{t(n.labelKey)}</span>
          {n.to === '/chats' && unread > 0 && <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className={`app-shell ${inRoom ? 'in-room' : ''}`}>
      <MessagePopups />
      <aside className="sidebar">
        <div className="logo-badge"><NexoMark size={26} /></div>
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
            <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 1 }}><IconAlert size={16} /></span>
            <span>{t('banner.demo')}</span>
          </div>
        )}
        {children}
      </div>
      <nav className="bottom-nav">{items('mobile')}</nav>
    </div>
  )
}
