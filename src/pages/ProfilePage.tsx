import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import { Avatar, ErrorBox } from '../components/ui'
import { useI18n } from '../i18n'
import { IconPlus, IconBack, IconChats, IconGroups, IconChannel, IconSearch, IconChecks, IconSettings } from '../components/icons'

export default function ProfilePage() {
  const { profile, refresh, signOut } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!profile) return <div className="page"><div className="center-loader"><div className="spinner" />{t('profile.loading')}</div></div>

  const startEdit = () => {
    setDisplayName(profile.display_name); setUsername(profile.username); setBio(profile.bio || '')
    setError(''); setNotice(''); setEditing(true)
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      await api.updateProfile(profile.id, { display_name: displayName.trim(), username, bio: bio.trim() })
      await refresh()
      setEditing(false); setNotice(t('profile.saved'))
    } catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setSaving(false) }
  }

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const url = await api.uploadAvatar(file, profile.id)
      await api.updateProfile(profile.id, { avatar_url: url })
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const doSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('profile.title')}</h1>
          <p className="page-sub">{t('profile.sub')}</p>
        </div>
        {!editing && <button className="btn btn-primary" onClick={startEdit}>{t('profile.edit')}</button>}
      </div>

      <ErrorBox error={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <div className="profile-hero glass card">
        <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar profile={profile} size={92} showOnline /></div>
        <h2 style={{ margin: '14px 0 2px', fontSize: 22, letterSpacing: '-0.4px' }}>{profile.display_name}</h2>
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>@{profile.username}</div>
        <div style={{ marginTop: 8 }}><span className="pill"><span style={{ width: 7, height: 7, borderRadius: '50%', background: profile.is_online ? 'var(--ok)' : 'var(--text-3)', display: 'inline-block' }} />{profile.is_online ? t('profile.onlineNow') : t('profile.offlineNow')}</span></div>
        {profile.bio && <p style={{ color: 'var(--text-2)', maxWidth: 420, margin: '14px auto 0', fontSize: 14 }}>{profile.bio}</p>}
        <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => changeAvatar(e.target.files?.[0])} />
        <button className="btn btn-sm" style={{ marginTop: 16 }} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? t('profile.uploading') : t('profile.changeAvatar')}
        </button>
      </div>

      {editing ? (
        <div className="settings-group glass card">
          <div className="field" style={{ marginTop: 14 }}><label>{t('auth.displayName')}</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div className="field"><label>{t('auth.username')}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{t('profile.usernameAvail')}</div></div>
          <div className="field"><label>{t('profile.bio')}</label>
            <textarea className="textarea" rows={3} maxLength={200} placeholder={t('profile.bioPlaceholder')} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 10, paddingBottom: 14 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving || !displayName.trim()} onClick={save}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-group glass card">
          <div className="switch-row">
            <div><div className="sw-title">{t('profile.memberSince')}</div><div className="sw-sub">{new Date(profile.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
          </div>
          <div className="switch-row">
            <div><div className="sw-title">{t('profile.accountId')}</div><div className="sw-sub" style={{ wordBreak: 'break-all' }}>{profile.id}</div></div>
          </div>
          <div className="switch-row">
            <div><div className="sw-title">{t('profile.backend')}</div><div className="sw-sub">{api.mode === 'supabase' ? t('profile.backendSupabase') : t('profile.backendLocal')}</div></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => navigate('/settings')}><IconSettings size={16} /> {t('profile.openSettings')}</button>
        <button className="btn btn-danger" style={{ flex: 1 }} onClick={doSignOut}>{t('profile.signOut')}</button>
      </div>
    </div>
  )
}
