import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { Profile } from '../lib/types'
import { Avatar, EmptyState, ErrorBox, Modal, UserPicker, fmtTime } from '../components/ui'

export default function ChatsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<api.DirectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [ picked, setPicked ] = useState<Profile[]>([])
  const [starting, setStarting] = useState(false)

  const load = async () => {
    if (!profile) return
    try {
      setItems(await api.listDirectChats(profile.id))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chats')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const unsub = api.subscribeGlobal(load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const startChat = async () => {
    if (!profile || picked.length !== 1) return
    setStarting(true)
    try {
      const id = await api.getOrCreateDirect(profile.id, picked[0].id)
      setShowNew(false); setPicked([])
      navigate(`/chat/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start chat')
    } finally { setStarting(false) }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Chats</h1>
          <p className="page-sub">Your personal conversations, sorted by latest activity.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>＋ New chat</button>
      </div>

      <ErrorBox error={error} />
      {loading ? (
        <div className="center-loader"><div className="spinner" />Loading conversations…</div>
      ) : items.length === 0 ? (
        <EmptyState icon="💬" title="No conversations yet" text="Find someone by @username and start your first conversation. Messages sync in realtime.">
          <div style={{ marginTop: 18 }}><button className="btn btn-primary" onClick={() => setShowNew(true)}>Start a chat</button></div>
        </EmptyState>
      ) : (
        <div className="list">
          {items.map(({ conv, other, lastMessage, unread }) => (
            <button key={conv.id} className="row-card glass" onClick={() => navigate(`/chat/${conv.id}`)}>
              <Avatar profile={other} showOnline />
              <span className="row-main">
                <span className="row-title">{other.display_name}
                  <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 12.5 }}>@{other.username}</span></span>
                <span className="row-preview">
                  {lastMessage ? (lastMessage.sender_id === profile?.id ? 'You: ' : '') + (lastMessage.body || (lastMessage.attachment_url ? '📎 Attachment' : '')) : 'Say hello 👋'}
                </span>
              </span>
              <span className="row-meta">
                <span className="row-time">{fmtTime(conv.last_message_at)}</span>
                {unread > 0 && <span className="unread-dot">{unread}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {showNew && profile && (
        <Modal title="New chat" onClose={() => { setShowNew(false); setPicked([]) }}>
          <UserPicker meId={profile.id} selected={picked}
            onToggle={(p) => setPicked((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [p])} />
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => { setShowNew(false); setPicked([]) }}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={picked.length !== 1 || starting} onClick={startChat}>
              {starting ? 'Opening…' : 'Open chat'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
