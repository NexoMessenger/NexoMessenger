import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../i18n'

export default function AdminPanel() {
  const { t, locale } = useI18n()
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<api.AdminUser[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api.adminAccess().then(setAllowed).catch(() => setAllowed(false)) }, [])
  if (!allowed) return null
  const search = async () => {
    if (q.trim().length < 2) { setUsers([]); return }
    setBusy(true); setError(''); setSearched(false)
    try { setUsers(await api.adminSearch(q)); setSearched(true) } catch { setError(t('admin.error')) } finally { setBusy(false) }
  }
  const act = async (user: api.AdminUser, action: api.AdminAction) => {
    if (!window.confirm(t('admin.confirm', { action: t(`admin.action.${action}` as TranslationKey), user: `@${user.username}` }))) return
    setBusy(true); setError('')
    try { await api.adminAction(user.id, action); setUsers(await api.adminSearch(q)) } catch { setError(t('admin.error')) } finally { setBusy(false) }
  }
  return <>
    <div className="section-label">{t('admin.title')}</div>
    <div className="settings-group glass card admin-panel">
      <div className="switch-row"><div><div className="sw-title">{t('admin.title')}</div><div className="sw-sub">{t('admin.description')}</div></div><button className="btn btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>{t(open ? 'admin.close' : 'admin.open')}</button></div>
      {open && <div className="admin-content">
        <form onSubmit={e => { e.preventDefault(); void search() }} className="admin-search"><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.search')} aria-label={t('admin.search')} /><button className="btn btn-primary" disabled={busy || q.trim().length < 2}>{t('admin.find')}</button></form>
        {error && <div role="alert" className="error-box">{error}</div>}
        {searched && users.length === 0 && !error && <p className="sw-sub" role="status">{t('admin.notFound')}</p>}
        {users.map(user => <div className="admin-user" key={user.id}>
          <strong>{user.display_name}</strong><div className="sw-sub">@{user.username} · {t(`admin.status.${user.status}` as TranslationKey)} · {t('admin.balance')}: {user.balance === null ? '—' : user.balance.toLocaleString(locale)} NEX</div>
          <div className="admin-actions">{(['normal', 'frozen', 'banned', 'fake_ban', 'reset_nex'] as const).map(action => <button key={action} type="button" className="btn btn-sm" disabled={busy || action === user.status} onClick={() => void act(user, action)}>{t(`admin.action.${action}` as TranslationKey)}</button>)}</div>
        </div>)}
      </div>}
    </div>
  </>
}
