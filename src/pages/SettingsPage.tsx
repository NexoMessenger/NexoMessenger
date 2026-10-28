import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { UserSettings } from '../lib/types'
import { ErrorBox } from '../components/ui'

const THEMES: { id: UserSettings['theme']; label: string; hint: string }[] = [
  { id: 'nexoglass', label: 'NEXO Glass', hint: 'Default black glassmorphism' },
  { id: 'midnight', label: 'Midnight', hint: 'Deep blue-black glass' },
  { id: 'graphite', label: 'Graphite', hint: 'Neutral warm graphite' },
]

export default function SettingsPage() {
  const { profile, signOut, refresh } = useAuth()
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
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [profile])

  const save = async (patch: Partial<UserSettings>) => {
    if (!profile || !settings) return
    const next = { ...settings, ...patch }
    setSettings(next); setSaving(true); setError(''); setNotice('')
    try {
      await api.updateSettings(profile.id, patch)
      if (patch.theme) document.documentElement.dataset.theme = patch.theme
      setNotice('Settings saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings')
      setSettings(settings)
    } finally { setSaving(false) }
  }

  const doSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Every control here is wired to a real, persisted setting.</p>
        </div>
        {saving && <span className="pill">Saving…</span>}
      </div>

      <ErrorBox error={error} />
      {notice && <div className="notice-box">{notice}</div>}
      {loading || !settings || !profile ? (
        <div className="center-loader"><div className="spinner" />Loading settings…</div>
      ) : (
        <>
          <div className="section-label">Account</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div><div className="sw-title">{profile.display_name}</div><div className="sw-sub">@{profile.username} · Member since {new Date(profile.created_at).toLocaleDateString()}</div></div>
              <button className="btn btn-sm" onClick={() => navigate('/profile')}>View profile</button>
            </div>
            <div className="switch-row">
              <div><div className="sw-title">Backend mode</div><div className="sw-sub">{api.mode === 'supabase' ? 'Supabase cloud backend' : 'Local Demo Mode (this browser only) — add Supabase keys to go live'}</div></div>
              <span className="pill">{api.mode}</span>
            </div>
          </div>

          <div className="section-label">Appearance</div>
          <div className="settings-group glass card">
            <div style={{ padding: '14px 0 6px' }}>
              <div className="sw-title" style={{ fontWeight: 620, fontSize: 14.5 }}>Theme</div>
              <div className="sw-sub" style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '2px 0 12px' }}>All themes keep the black transparent glass design. Saved to your account.</div>
              <div className="seg">
                {THEMES.map((t) => (
                  <button key={t.id} className={settings.theme === t.id ? 'active' : ''} onClick={() => save({ theme: t.id })} title={t.hint}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-label">Notifications</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div>
                <div className="sw-title">Message notifications</div>
                <div className="sw-sub">Stored preference used for in-app unread badges{api.mode === 'supabase' ? ' and push configuration' : ''}. Browser push requires Supabase + a push service and is not faked here.</div>
              </div>
              <button className={`toggle ${settings.notifications_enabled ? 'on' : ''}`} aria-label="Toggle notifications"
                onClick={() => save({ notifications_enabled: !settings.notifications_enabled })} />
            </div>
          </div>

          <div className="section-label">Privacy</div>
          <div className="settings-group glass card">
            <div className="switch-row">
              <div>
                <div className="sw-title">Profile visibility</div>
                <div className="sw-sub">Public profiles appear in Search results. Private hides the “Message” shortcut for non-contacts where the backend enforces it.</div>
              </div>
              <div className="seg" style={{ width: 190, flexShrink: 0 }}>
                <button className={settings.privacy_profile === 'public' ? 'active' : ''} onClick={() => save({ privacy_profile: 'public' })}>Public</button>
                <button className={settings.privacy_profile === 'private' ? 'active' : ''} onClick={() => save({ privacy_profile: 'private' })}>Private</button>
              </div>
            </div>
            <div className="switch-row">
              <div>
                <div className="sw-title">Online status</div>
                <div className="sw-sub">Your online indicator is driven by real presence: it turns off on sign-out or tab close, and heartbeats while you use NEXO.</div>
              </div>
              <span className="pill">{profile.is_online ? 'Online now' : 'Offline'}</span>
            </div>
          </div>

          <button className="btn btn-danger btn-block" onClick={doSignOut}>Sign out of NEXO</button>
          <p style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginTop: 16 }}>
            NEXO Messenger · Changes persist in {api.mode === 'supabase' ? 'your Supabase database' : 'this browser (Demo Mode)'} · <button className="link-btn" onClick={refresh}>Refresh session</button>
          </p>
        </>
      )}
    </div>
  )
}
