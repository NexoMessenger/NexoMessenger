import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import { EmptyState, ErrorBox, GroupAvatar, Modal } from '../components/ui'

export default function ChannelsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<api.ChannelListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState('')

  const load = async () => {
    if (!profile) return
    try { setItems(await api.listChannels(profile.id)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load channels') }
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
      const id = await api.createChannel(profile.id, name, description, isPublic)
      setShowCreate(false); setName(''); setDescription(''); setIsPublic(true)
      navigate(`/channel/${id}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create channel') }
    finally { setCreating(false) }
  }

  const toggleSub = async (item: api.ChannelListItem) => {
    if (!profile) return
    setBusyId(item.channel.id)
    try {
      if (item.myRole) await api.unsubscribeChannel(item.channel.id, profile.id)
      else await api.subscribeChannel(item.channel.id, profile.id)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Subscription failed') }
    finally { setBusyId('') }
  }

  const subscribed = items.filter((i) => i.myRole)
  const discover = items.filter((i) => !i.myRole)

  const renderItem = (item: api.ChannelListItem) => (
    <div key={item.channel.id} className="row-card glass">
      <button style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', padding: 0, color: 'inherit' }}
        onClick={() => navigate(`/channel/${item.channel.id}`)}>
        <GroupAvatar name={item.channel.name} url={item.channel.avatar_url} />
        <span className="row-main">
          <span className="row-title">{item.channel.name}
            <span className="pill">{item.channel.is_public ? 'Public' : 'Private'}</span>
            {item.canPost && <span className="pill pill-accent">Can post</span>}
          </span>
          <span className="row-preview">{item.subscribers} subscribers{item.channel.description ? ` · ${item.channel.description}` : ''}</span>
        </span>
      </button>
      {item.channel.owner_id !== profile?.id && (
        <button className={`btn btn-sm ${item.myRole ? '' : 'btn-primary'}`} disabled={busyId === item.channel.id} onClick={() => toggleSub(item)}>
          {busyId === item.channel.id ? '…' : item.myRole ? 'Subscribed' : 'Subscribe'}
        </button>
      )}
    </div>
  )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Channels</h1>
          <p className="page-sub">Broadcasts from owners and authorized publishers. Subscribers read — they cannot post unless granted permission.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ Create channel</button>
      </div>
      <ErrorBox error={error} />
      {loading ? <div className="center-loader"><div className="spinner" />Loading channels…</div>
      : items.length === 0 ? (
        <EmptyState icon="📣" title="No channels yet" text="Create a channel to broadcast, or find public channels in Search.">
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create a channel</button></div>
        </EmptyState>
      ) : (
        <>
          {subscribed.length > 0 && <><div className="section-label">Your channels</div><div className="list">{subscribed.map(renderItem)}</div></>}
          {discover.length > 0 && <><div className="section-label">Discover public channels</div><div className="list">{discover.map(renderItem)}</div></>}
        </>
      )}

      {showCreate && (
        <Modal title="Create channel" onClose={() => setShowCreate(false)}>
          <div className="field"><label>Channel name *</label>
            <input className="input" placeholder="e.g. NEXO Updates" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="field"><label>Description</label>
            <textarea className="textarea" rows={3} placeholder="What will you broadcast?" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <label className="check-row">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public channel (anyone can find and subscribe)
          </label>
          <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Private channels are visible only to members. Only owners, admins and users you grant posting rights can publish — enforced by the backend (RLS), not just this screen.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!name.trim() || creating} onClick={create}>
              {creating ? 'Creating…' : 'Create channel'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
