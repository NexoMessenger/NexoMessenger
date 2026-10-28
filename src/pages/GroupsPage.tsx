import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { EmptyState, ErrorBox, GroupAvatar, Modal, UserPicker, fmtTime } from '../components/ui'
import { useI18n } from '../i18n'
import { IconPlus, IconBack, IconChats, IconGroups, IconChannel, IconSearch, IconChecks, IconSettings } from '../components/icons'

export default function GroupsPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState<api.GroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [members, setMembers] = useState<Profile[]>([])
  const [creating, setCreating] = useState(false)

  const load = async () => {
    if (!profile) return
    try { setItems(await api.listGroups(profile.id)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const unsub = api.subscribeGlobal(load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const create = async () => {
    if (!profile || creating) return // guard against duplicate group creation
    setCreating(true)
    try {
      const id = await api.createGroup(profile.id, name, description, isPublic, members.map((m) => m.id))
      setShowCreate(false); setName(''); setDescription(''); setMembers([]); setIsPublic(false)
      navigate(`/group/${id}`)
    } catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
    finally { setCreating(false) }
  }

  const toggle = (p: Profile) => setMembers((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('groups.title')}</h1>
          <p className="page-sub">{t('groups.sub')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><IconPlus size={16} /> {t('groups.create')}</button>
      </div>
      <ErrorBox error={error} />
      {loading ? <div className="center-loader"><div className="spinner" />{t('groups.loading')}</div>
      : items.length === 0 ? (
        <EmptyState icon={<IconGroups size={30} />} title={t('groups.emptyTitle')} text={t('groups.emptyText')}>
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setShowCreate(true)}><IconPlus size={16} /> {t('groups.createFirst')}</button></div>
        </EmptyState>
      ) : (
        <div className="list">
          {items.map(({ group, unread, lastMessage, memberCount, myRole }) => (
            <button key={group.id} className="row-card glass" onClick={() => navigate(`/group/${group.id}`)}>
              <GroupAvatar name={group.name} url={group.avatar_url} />
              <span className="row-main">
                <span className="row-title">{group.name}
                  <span className="pill">{group.is_public ? t('common.public') : t('common.private')}</span>
                  {myRole !== 'member' && <span className="pill pill-accent">{myRole}</span>}
                </span>
                <span className="row-preview">{memberCount} {t('common.members')}{lastMessage ? ` · ${lastMessage.body || t('common.attachment')}` : ''}</span>
              </span>
              <span className="row-meta">
                <span className="row-time">{fmtTime(group.last_message_at)}</span>
                {unread > 0 && <span className="unread-dot">{unread}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreate && profile && (
        <Modal title={t('groups.createTitle')} onClose={() => setShowCreate(false)}>
          <div className="field"><label>{t('groups.name')}</label>
            <input className="input" placeholder={t('groups.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><label>{t('groups.description')}</label>
            <input className="input" placeholder={t('groups.descPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <label className="check-row">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {t('groups.publicLabel')}
          </label>
          <div className="section-label">{t('groups.addMembers')}</div>
          <UserPicker meId={profile.id} selected={members} onToggle={toggle} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!name.trim() || creating} onClick={create}>
              {creating ? t('groups.creating') : t('groups.createTitle')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
