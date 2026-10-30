import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { UserSettings } from '../lib/types'
import { ErrorBox, errText } from '../components/ui'
import { PROFILE_FONTS, PROFILE_THEMES, isPremiumActive, profileFontClass } from '../lib/premiumData'
import { useI18n, type TranslationKey } from '../i18n'
import { LOCALES } from '../i18n/translations'

const THEMES: { id: UserSettings['theme']; labelKey: TranslationKey; hintKey: TranslationKey; swatches: [string, string, string] }[] = [
  { id: 'nexoglass', labelKey: 'settings.themeDark', hintKey: 'settings.themeDarkHint', swatches: ['#050507', '#8b5cf6', '#f0abfc'] },
  { id: 'lime', labelKey: 'settings.themeLime', hintKey: 'settings.themeLimeHint', swatches: ['#050805', '#84cc16', '#bef264'] },
  { id: 'light', labelKey: 'settings.themeLight', hintKey: 'settings.themeLightHint', swatches: ['#ffffff', '#7c3aed', '#c026d3'] },
  { id: 'coffee', labelKey: 'settings.themeCoffee', hintKey: 'settings.themeCoffeeHint', swatches: ['#120b06', '#d97706', '#fbbf24'] },
  { id: 'sakura', labelKey: 'settings.themeSakura', hintKey: 'settings.themeSakuraHint', swatches: ['#150711', '#ec4899', '#f9a8d4'] },
  { id: 'ocean', labelKey: 'settings.themeOcean', hintKey: 'settings.themeOceanHint', swatches: ['#020914', '#0284c7', '#7dd3fc'] },
  { id: 'sunset', labelKey: 'settings.themeSunset', hintKey: 'settings.themeSunsetHint', swatches: ['#14060d', '#f97316', '#fda4af'] },
  { id: 'midnight', labelKey: 'settings.themeMidnight', hintKey: 'settings.themeMidnightHint', swatches: ['#04060d', '#3b82f6', '#93c5fd'] },
  { id: 'graphite', labelKey: 'settings.themeGraphite', hintKey: 'settings.themeGraphiteHint', swatches: ['#080808', '#71717a', '#d4d4d8'] },
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
      .catch((e) => setError(errText(e, t)))
      .finally(() => setLoading(false))
  }, [profile])

  const save = async (patch: Partial<UserSettings>) => {
    if (!profile || !settings) return
    const next = { ...settings, ...patch }
    setSettings(next); setSaving(true); setError(''); setNotice('')
    if (patch.theme) {
      document.documentElement.dataset.theme = patch.theme
      try { localStorage.setItem('nexo_theme', patch.theme) } catch { /* ignore */ }
    }
    try {
      await api.updateSettings(profile.id, patch)
      setNotice(t('settings.saved'))
    } catch (e) {
      setError(errText(e, t))
      setSettings(settings)
      if (patch.theme) {
        document.documentElement.dataset.theme = settings.theme
        try { localStorage.setItem('nexo_theme', settings.theme) } catch { /* ignore */ }
      }
    } finally { setSaving(false) }
  }

  const doSignOut = async () => { await signOut(); navigate('/login') }

  const saveProfileStyle = async (patch: { font?: string; profileTheme?: string }) => {
    if (!profile) return
    setSaving(true); setError(''); setNotice('')
    try {
      await api.updatePremiumDecor(patch)
      await refresh()
      setNotice(t('settings.saved'))
    } catch (e) { setError(errText(e, t)) } finally { setSaving(false) }
  }

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
              <div><div className="sw-title">{t('settings.backendMode')}</div><div className="sw-sub">{api.mode === 'server' ? t('settings.backendServer') : api.mode === 'supabase' ? t('settings.backendSupabase') : t('settings.backendLocal')}</div></div>
              <span className="pill">{api.mode}</span>
            </div>
          </div>

          <div className="section-label">{t('settings.appearance')}</div>
          <div className="settings-group glass card">
            <div style={{ padding: '14px 0 6px' }}>
              <div className="sw-title" style={{ fontWeight: 620, fontSize: 14.5 }}>{t('settings.theme')}</div>
              <div className="sw-sub" style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '2px 0 12px' }}>{t('settings.themeSub')}</div>
              <div className="theme-grid">
                {THEMES.map((theme) => (
                  <button key={theme.id} type="button" className={`theme-card ${settings.theme === theme.id ? 'active' : ''}`}
                    onClick={() => save({ theme: theme.id })} aria-pressed={settings.theme === theme.id}>
                    <span className="theme-swatches">
                      {theme.swatches.map((color) => <span key={color} className="theme-swatch" style={{ background: color }} />)}
                    </span>
                    <span className="theme-card-name">{t(theme.labelKey)}{settings.theme === theme.id && <span className="theme-check">{t('settings.themeActive')}</span>}</span>
                    <span className="theme-card-hint">{t(theme.hintKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-label">{t('settings.profileStyle')}</div>
          <div className="settings-group glass card">
            <div style={{ padding: '14px 0 10px' }}>
              <div className="sw-title" style={{ fontWeight: 620, fontSize: 14.5 }}>{t('settings.fontTitle')}</div>
              <div className="sw-sub" style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '2px 0 12px' }}>{t('settings.premiumHint')}</div>
              {!isPremiumActive(profile) && (
                <button className="btn btn-primary btn-sm" style={{ marginBottom: 12 }} onClick={() => navigate('/premium')}>
                  {t('premium.getPremium')}
                </button>
              )}
              <div className="premium-colors">
                {PROFILE_FONTS.map((f) => (
                  <button key={f} type="button" disabled={!isPremiumActive(profile)}
                    className={`premium-color ${(profile.profile_font || 'default') === f ? 'active' : ''}`}
                    onClick={() => void saveProfileStyle({ font: f })}>
                    <span className={profileFontClass(f)}>NEXO · {t(`settings.font.${f}` as TranslationKey)}</span>
                  </button>
                ))}
              </div>
              <div className="sw-title" style={{ fontWeight: 620, fontSize: 14.5, marginTop: 8 }}>{t('settings.profileThemeTitle')}</div>
              <div className="premium-colors" style={{ marginTop: 10 }}>
                {PROFILE_THEMES.map((th) => (
                  <button key={th} type="button" disabled={!isPremiumActive(profile)}
                    className={`premium-color ${(profile.profile_theme || 'default') === th ? 'active' : ''}`}
                    onClick={() => void saveProfileStyle({ profileTheme: th })}>
                    {t(`settings.ptheme.${th}` as TranslationKey)}
                  </button>
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
            {t('settings.footer')} {api.mode !== 'local' ? t('settings.inDb') : t('settings.inBrowser')} · <button className="link-btn" onClick={refresh}>{t('settings.refreshSession')}</button>
          </p>
        </>
      )}
    </div>
  )
}
