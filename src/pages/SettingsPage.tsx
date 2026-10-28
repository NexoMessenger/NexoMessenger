import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { UserSettings } from '../lib/types'
import { ErrorBox } from '../components/ui'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n/translations'

const THEMES: { id: UserSettings['theme']; label: string; hint: string }[] = [
  { id: 'nexoglass', label: 'NEXO Glass', hint: 'Default black glassmorphism' },
  { id: 'midnight', label: 'Midnight', hint: 'Deep blue-black glass' },
  { id: 'graphite', label: 'Graphite', hint: 'Neutral warm graphite' },
]

export default function SettingsPage() {
  const { profile, signOut, refresh } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    api.getSettings(profile.id)
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : t('error.generic')))
      .finally(() => setLoading(false))
  }, [profile])

  const save = async (patch: Partial<UserSettings>) => {
    if (!profile || !settings) return
    const next = { ...settings, ...patch }
    setSettings(next); setSaving(true); setError(''); setNotice('')
    try {
      await api.updateSettings(profile.id, patch)
      if (patch.theme) document.documentElement.dataset.theme = patch.theme
      setNotice(t('settings.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.generic'))
      setSettings(settings)
    } finally { setSaving(false) }
  }

  const doSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.sub')}</p>
        </div>
        {saving && <span className="pill">{t('common.saving')}</span>}
      </div>

      <ErrorBox error={error} />
      {notice && <div className="notice-box">{notice}</div>}
      {loading || !settings || !profile ? (
        <div className="center-loader"><div className="spinner" />{t('settings.loading')}</div>
      ) : (
        <>
          <div className="section-label">{t('settings.account')}</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div><div className="sw-title">{profile.display_name}</div><div className="sw-sub">@{profile.username} · {t('profile.memberSince')} {new Date(profile.created_at).toLocaleDateString(locale)}</div></div>
              <button className="btn btn-sm" onClick={() => navigate('/profile')}>{t('settings.viewProfile')}</button>
            </div>
            <div className="switch-row">
              <div><div className="sw-title">{t('settings.backendMode')}</div><div className="sw-sub">{api.mode === 'supabase' ? t('settings.backendSupabase') : t('settings.backendLocal')}</div></div>
              <span className="pill">{api.mode}</span>
            </div>
          </div>

          <div className="section-label">{t('settings.appearance')}</div>
          <div className="settings-group glass card">
            <div style={{ padding: '14px 0 6px' }}>
              <div className="sw-title" style={{ fontWeight: 620, fontSize: 14.5 }}>{t('settings.theme')}</div>
              <div className="sw-sub" style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '2px 0 12px' }}>{t('settings.themeSub')}</div>
              <div className="seg">
                {THEMES.map((t) => (
                  <button key={t.id} className={settings.theme === t.id ? 'active' : ''} onClick={() => save({ theme: t.id })} title={t.hint}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-label">{t('settings.language')}</div>
          <div className="settings-group glass card">
            <div style={{ padding: '14px 0 10px' }}>
              <div className="sw-sub" style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '0 0 12px' }}>{t('settings.languageSub')}</div>
              <div className="seg" style={{ flexWrap: 'wrap' }}>
                {LOCALES.map((l) => (
                  <button key={l.code} className={locale === l.code ? 'active' : ''} aria-label={`${l.flag} ${l.native} (${l.english})`} onClick={() => setLocale(l.code)}>{l.flag} {l.native}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-label">{t('settings.notifications')}</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div>
                <div className="sw-title">{t('settings.notifTitle')}</div>
                <div className="sw-sub">{t('settings.notifSub')}</div>
              </div>
              <button className={`toggle ${settings.notifications_enabled ? 'on' : ''}`} aria-label="Toggle notifications"
                onClick={() => save({ notifications_enabled: !settings.notifications_enabled })} />
            </div>
          </div>

          <div className="section-label">{t('settings.privacy')}</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div>
                <div className="sw-title">{t('settings.profileVisibility')}</div>
                <div className="sw-sub">{t('settings.profileVisibilitySub')}</div>
              </div>
              <div className="seg" style={{ width: 190, flexShrink: 0 }}>
                <button className={settings.privacy_profile === 'public' ? 'active' : ''} onClick={() => save({ privacy_profile: 'public' })}>{t('common.public')}</button>
                <button className={settings.privacy_profile === 'private' ? 'active' : ''} onClick={() => save({ privacy_profile: 'private' })}>{t('common.private')}</button>
              </div>
            </div>
            <div className="switch-row">
              <div>
                <div className="sw-title">{t('settings.onlineStatus')}</div>
                <div className="sw-sub">{t('settings.onlineStatusSub')}</div>
              </div>
              <span className="pill">{profile.is_online ? t('settings.onlineNow') : t('common.offline')}</span>
            </div>
          </div>

          <button className="btn btn-danger btn-block" onClick={doSignOut}>{t('settings.signOut')}</button>
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginTop: 16 }}>
            {t('settings.footer')} {api.mode === 'supabase' ? t('settings.inDb') : t('settings.inBrowser')} · <button className="link-btn" onClick={refresh}>{t('settings.refreshSession')}</button>
          </p>
        </>
      )}
    </div>
  )
}
