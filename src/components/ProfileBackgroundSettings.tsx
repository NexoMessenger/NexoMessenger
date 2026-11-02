import { useState } from 'react'
import { ProfileBackground as BackgroundView } from './ProfileBackground'
import { useAuth } from '../lib/AuthContext'
import { isPremiumActive } from '../lib/premiumData'
import { PROFILE_BACKGROUNDS, type ProfileBackground } from '../lib/profileBackgrounds'
import { useI18n, type TranslationKey } from '../i18n'
import * as api from '../lib/api'
import { ErrorBox, errText } from './ui'

/** The same account-wide selection is available from both Profile and Premium. */
export function ProfileBackgroundSettings({ preview = false }: { preview?: boolean }) {
  const { profile, refresh } = useAuth()
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (!profile) return null
  const active = isPremiumActive(profile)
  const choose = async (value: ProfileBackground) => {
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try { await api.updateProfile(profile.id, { profile_background: value }); await refresh(); setNotice(t('profileBackground.saved')) }
    catch (e) { setError(errText(e, t)) } finally { setSaving(false) }
  }
  return <div className="settings-group glass card profile-background-settings">
    <div className="sw-title">{t('profileBackground.title')}</div>
    <p className="premium-hint">{t('profileBackground.hint')}</p>
    <p className="premium-hint">{t('profileBackground.premiumHint')}</p>
    {preview && profile.profile_background && <div className="profile-background-live-preview"><BackgroundView value={profile.profile_background} premiumActive={active} /><strong>{profile.display_name}</strong></div>}
    <ErrorBox error={error} />{notice && <div className="notice-box" role="status">{notice}</div>}
    {api.mode === 'supabase' ? <p role="status">{t('profileBackground.unavailable')}</p> : <div className="profile-background-options" role="group" aria-label={t('profileBackground.title')}>
      <button type="button" className={`profile-background-option profile-background-none ${!profile.profile_background ? 'active' : ''}`} aria-pressed={!profile.profile_background} disabled={saving} onClick={() => void choose('')}><span>{t('profileBackground.none')}</span></button>
      {PROFILE_BACKGROUNDS.map(item => <button type="button" key={item.id} className={`profile-background-option ${profile.profile_background === item.id ? 'active' : ''}`} aria-pressed={profile.profile_background === item.id} disabled={saving || (item.premium && !active)} onClick={() => void choose(item.id)}>
        <img src={item.poster} alt="" loading="lazy" /><span>{t(item.label as TranslationKey)}{item.premium ? ' · Premium' : ''}</span>
      </button>)}
    </div>}
  </div>
}
