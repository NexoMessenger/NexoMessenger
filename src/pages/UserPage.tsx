import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { useI18n } from '../i18n'
import { Avatar, BusinessBadge, ErrorBox, FloatingGifts, ProfileMusicCard, ProfileName, errText, fmtLastSeen, profileThemeClass } from '../components/ui'
import { IconBack, IconChats } from '../components/icons'
import ProfileShowcase from '../components/ProfileShowcase'

/**
 * Full-screen public profile page. This deliberately replaces the old
 * half-screen profile modal: from a chat, search result, or group member
 * list the profile now occupies the whole content area, with normal back
 * navigation returning to the place the user came from.
 */
export default function UserPage() {
  const { id = '' } = useParams()
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
      const p = await api.getProfile(id)
      if (reqRef.current !== req) return
      if (!p) {
        setUser(null)
        setError(t('error.profileNotFound'))
        return
      }
      setUser(p)
    } catch (e) {
      if (reqRef.current !== req) return
      setError(errText(e, t))
    }
  }, [id, t])

  useEffect(() => { void load() }, [load])

  if (me && id === me.id) return <Navigate to="/profile" replace />

  const message = async () => {
    if (!me || !user) return
    setBusy(true)
    setError('')
    try {
      const convId = await api.getOrCreateDirect(me.id, user.id)
      navigate(`/chat/${convId}`)
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  const since = user ? new Date(user.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="page user-profile-page">
      <div className="page-head user-profile-head">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back')}>
          <IconBack size={19} />
        </button>
        <div>
          <h1 className="page-title">{t('profile.view')}</h1>
          <p className="page-sub">{user ? `@${user.username}` : ''}</p>
        </div>
      </div>

      {!user && !error && (
        <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
      )}

      {error && !user && (
        <div className="settings-group glass card" style={{ textAlign: 'center' }}>
          <ErrorBox error={error} />
          <button className="btn" onClick={() => void load()}>{t('common.retry')}</button>
        </div>
      )}

      {user && (
        <>
          <div className={`profile-hero glass card user-profile-hero ${profileThemeClass(user.profile_theme)}`}>
            <FloatingGifts profile={user} />
            <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar profile={user} size={96} showOnline /></div>
            <h2><ProfileName profile={user} /></h2>
            <div className="username-line">@{user.username}</div>
            {user.business?.enabled && (
              <div style={{ marginTop: 9, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                <BusinessBadge profile={user} />
                {user.business.name && <span className="pill">{user.business.name}</span>}
                {user.business.address && <span className="pill">{user.business.address}</span>}
              </div>
            )}
            <div style={{ marginTop: 9 }}>
              <span className="pill">
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: user.is_online ? 'var(--ok)' : 'var(--text-3)', display: 'inline-block' }} />
                {fmtLastSeen(user, { online: t('common.online'), lastSeen: t('room.lastSeen') }, locale)}
              </span>
            </div>
            {user.bio && <p className="user-profile-bio-full">{user.bio}</p>}

            <div className="user-profile-meta">
              <span>{t('profile.memberSince')}</span>
              <strong>{since}</strong>
            </div>

            <ErrorBox error={error} />
            <ProfileMusicCard profile={user} />
            {me && user.id !== me.id && (
              <button className="btn btn-primary btn-block" style={{ maxWidth: 360, margin: '16px auto 0' }} disabled={busy} onClick={() => void message()}>
                <IconChats size={17} /> {busy ? t('common.loading') : t('search.message')}
              </button>
            )}
          </div>

          <div className="settings-group glass card" style={{ marginBottom: 14 }}>
            <ProfileShowcase userId={user.id} isOwn={false} owner={user} />
          </div>
        </>
      )}
    </div>
  )
}
