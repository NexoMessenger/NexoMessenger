import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { Avatar, Modal, errText } from './ui'
import { IconChats, IconClose } from './icons'

/**
 * Public profile card for a found user (search results, group members, …).
 * Shows only public fields (avatar, display name, @username, bio, online
 * status, member-since date) — never email or private data. Offers a direct
 * "message" action that opens/creates the 1-to-1 conversation.
 */
export default function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { profile: me } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [user, setUser] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reqRef = useRef(0)

  const load = useCallback(async () => {
    const req = ++reqRef.current
    setError('')
    try {
      const p = await api.getProfile(userId)
      if (reqRef.current !== req) return
      setUser(p)
    } catch (e) {
      if (reqRef.current !== req) return
      setError(errText(e, t))
    }
  }, [userId, t])

  useEffect(() => { void load() }, [load])

  const message = async () => {
    if (!me || !user) return
    setBusy(true)
    try {
      const convId = await api.getOrCreateDirect(me.id, user.id)
      onClose()
      navigate(`/chat/${convId}`)
    } catch (e) { setError(errText(e, t)) } finally { setBusy(false) }
  }

  const since = user ? new Date(user.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : ''

  return (
    <Modal title={t('profile.view')} onClose={onClose}>
      {error && !user && (
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
          <button className="btn" onClick={() => void load()}>{t('common.retry')}</button>
        </div>
      )}
      {!user && !error && <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>}
      {user && (
        <div className="user-profile-card">
          <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar profile={user} size={84} showOnline /></div>
          <h3 className="user-profile-name">{user.display_name}</h3>
          <div className="user-profile-username">@{user.username}</div>
          <div className={`user-profile-status ${user.is_online ? 'on' : ''}`}>
            <span className="presence-dot" />{user.is_online ? t('common.online') : t('common.offline')}
          </div>
          {user.bio && <p className="user-profile-bio">{user.bio}</p>}
          <p className="user-profile-since">{t('profile.memberSince')} {since}</p>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13.5, margin: '0 0 10px' }}>{error}</p>}
          {me && user.id !== me.id ? (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => void message()}>
              <IconChats size={16} /> {busy ? '…' : t('search.message')}
            </button>
          ) : (
            <button className="btn btn-block" onClick={onClose}><IconClose size={16} /> {t('common.cancel')}</button>
          )}
        </div>
      )}
    </Modal>
  )
}
