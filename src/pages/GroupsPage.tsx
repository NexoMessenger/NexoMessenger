import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { EmptyState, ErrorBox, GroupAvatar, Modal, UserPicker, fmtTime } from '../components/ui'

export default function GroupsPage() {
  const { profile } = useAuth()
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
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load groups') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const unsub = api.subscribeGlobal(load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const create = async () => {
    if (!profile) return
    setCreating(true)
    try {
      const id = await api.createGroup(profile.id, name, description, isPublic, members.map((m) => m.id))
      setShowCreate(false); setName(''); setDescription(''); setMembers([]); setIsPublic(false)
      navigate(`/group/${id}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create group') }
    finally { setCreating(false) }
  }

  const toggle = (p: Profile) => setMembers((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Groups</h1>
          <p className="page-sub">Group conversations with roles, members and realtime messages.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ Create group</button>
      </div>
      <ErrorBox error={error} />
      {loading ? <div className="center-loader"><div className="spinner" />Loading groups…</div>
      : items.length === 0 ? (
        <EmptyState icon="👥" title="No groups yet" text="Create a group, add registered users and chat together. Only members can read private groups.">
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create your first group</button></div>
        </EmptyState>
      ) : (
        <div className="list">
          {items.map(({ group, unread, lastMessage, memberCount, myRole }) => (
            <button key={group.id} className="row-card glass" onClick={() => navigate(`/group/${group.id}`)}>
              <GroupAvatar name={group.name} url={group.avatar_url} />
              <span className="row-main">
                <span className="row-title">{group.name}
                  <span className="pill">{group.is_public ? 'Public' : 'Private'}</span>
                  {myRole !== 'member' && <span className="pill pill-accent">{myRole}</span>}
                </span>
                <span className="row-preview">{memberCount} members{lastMessage ? ` · ${lastMessage.body || '📎 Attachment'}` : ''}</span>
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
        <Modal title="Create group" onClose={() => setShowCreate(false)}>
          <div className="field"><label>Group name *</label>
            <input className="input" placeholder="e.g. Design Circle" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><label>Description</label>
            <input className="input" placeholder="What is this group about?" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <label className="check-row">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public group (discoverable in Search)
          </label>
          <div className="section-label">Add members</div>
          <UserPicker meId={profile.id} selected={members} onToggle={toggle} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!name.trim() || creating} onClick={create}>
              {creating ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
