import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import * as api from '../lib/api'
import { IconClose, IconChats } from './icons'

type Popup = { id: string; path: string; name: string }

/** In-app alerts are based on actual new unread messages, not generic change events. */
export default function MessagePopups() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const navigate = useNavigate()
  const [popup, setPopup] = useState<Popup | null>(null)
  const timer = useRef<number | undefined>()

  useEffect(() => {
    if (!profile) return
    let alive = true, running = false, again = false, initialized = false
    const seen = new Map<string, string>()
    const load = async () => {
      if (running) { again = true; return }
      running = true
      do {
        again = false
        try {
          const [chats, groups, settings] = await Promise.all([api.listDirectChats(profile.id), api.listGroups(profile.id), api.getSettings(profile.id)])
          if (!alive) break
          const candidates: (Popup & { date: string; unread: number; sender: string })[] = [
            ...chats.filter(c => c.lastMessage).map(c => ({ id: c.lastMessage!.id, path: `/chat/${c.conv.id}`, name: c.other.display_name, date: c.lastMessage!.created_at, unread: c.unread, sender: c.lastMessage!.sender_id })),
            ...groups.filter(g => g.lastMessage).map(g => ({ id: g.lastMessage!.id, path: `/group/${g.group.id}`, name: g.group.name, date: g.lastMessage!.created_at, unread: g.unread, sender: g.lastMessage!.sender_id })),
          ]
          const fresh = candidates.filter(item => initialized && seen.get(item.path) !== item.id && item.unread > 0 && item.sender !== profile.id && item.path !== pathRef.current)
          for (const item of candidates) seen.set(item.path, item.id)
          initialized = true
          if (settings.notifications_enabled && document.visibilityState === 'visible' && fresh.length) {
            fresh.sort((a, b) => b.date.localeCompare(a.date))
            setPopup(fresh[0]); window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setPopup(null), 6000)
          }
        } catch { /* Keep the previous snapshot; a later realtime change retries. */ }
      } while (again && alive)
      running = false
    }
    void load()
    const unsubscribe = api.subscribeGlobal(() => { void load() })
    return () => { alive = false; unsubscribe(); window.clearTimeout(timer.current); setPopup(null) }
  }, [profile?.id])

  if (!popup || pathname === popup.path) return null
  return <div className="message-popup" role="status" aria-live="polite">
    <button className="message-popup-content" onClick={() => { navigate(popup.path); setPopup(null) }}>
      <span className="message-popup-icon"><IconChats size={20} /></span>
      <span className="message-popup-text"><strong>{popup.name}</strong><span>{t('popup.newMessage')}</span></span>
    </button>
    <button className="message-popup-close" aria-label={t('popup.close')} onClick={() => setPopup(null)}><IconClose size={17} /></button>
  </div>
}
