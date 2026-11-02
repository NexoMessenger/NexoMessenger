import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { Profile } from '../lib/types'

export function AccountRestrictionNotice({ kind, onClose }: { kind: 'frozen' | 'banned' | 'fake_ban', onClose: () => void }) {
  const { t } = useI18n()
  const frozen = kind === 'frozen'
  return <div className="restriction-overlay" role="presentation">
    <section className="restriction-card" role="dialog" aria-modal="true" aria-labelledby="restriction-title">
      <div className="restriction-symbol" aria-hidden="true">{frozen ? '❄' : '!'}</div>
      <h2 id="restriction-title">{t(frozen ? 'restriction.frozenTitle' : 'restriction.bannedTitle')}</h2>
      {kind === 'fake_ban' && <p className="restriction-test">{t('restriction.simulation')}</p>}
      <div className="restriction-row"><span className="restriction-icon" aria-hidden="true">◈</span><div><strong>{t(frozen ? 'restriction.frozenReason' : 'restriction.bannedReason')}</strong><p>{t(frozen ? 'restriction.frozenDescription' : kind === 'fake_ban' ? 'restriction.fakeDescription' : 'restriction.bannedDescription')}</p></div></div>
      {frozen && <div className="restriction-row"><span className="restriction-icon" aria-hidden="true">⊘</span><div><strong>{t('restriction.readOnly')}</strong><p>{t('restriction.readOnlyDescription')}</p></div></div>}
      <div className="restriction-row"><span className="restriction-icon" aria-hidden="true">✉</span><div><strong>{t('restriction.contact')}</strong><p>{t('restriction.contactDescription')}</p></div></div>
      <button type="button" className="btn btn-primary restriction-confirm" onClick={onClose}>{t('restriction.understood')}</button>
    </section>
  </div>
}

export function FrozenNotice({ profile }: { profile: Profile }) {
  const [dismissed, setDismissed] = useState('')
  const key = `${profile.id}:${profile.account_status_changed_at || 'frozen'}`
  useEffect(() => {
    try { setDismissed(sessionStorage.getItem('nexo_frozen_notice') || '') } catch { setDismissed('') }
  }, [key])
  if (profile.account_status !== 'frozen' || dismissed === key) return null
  return <AccountRestrictionNotice kind="frozen" onClose={() => { try { sessionStorage.setItem('nexo_frozen_notice', key) } catch { /* no storage */ }; setDismissed(key) }} />
}
