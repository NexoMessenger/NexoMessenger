import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Message, Profile } from '../lib/types'
import Composer from '../components/Composer'
import { AttachmentView, Avatar, ErrorBox, fmtClock, fmtLastSeen } from '../components/ui'

export default function ChatRoomPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [peer, setPeer] = useState<Profile | null>(null)
  const [peerReadAt, setPeerReadAt] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingName, setTypingName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<number>()

  const load = async () => {
    if (!profile) return
    try {
      const [msgs, p] = await Promise.all([api.listMessages(id), api.getDirectPeer(id, profile.id)])
      setMessages(msgs); setPeer(p); setError('')
      await api.markDirectRead(id, profile.id)
      // Read receipt approximation: peer's last_read vs my last message time is
      // refreshed via profiles/messages polling below in Supabase mode; local mode
      // computes peer read state from conv members through listDirectChats.
      const chats = await api.listDirectChats(profile.id)
      const mine = chats.find((c) => c.conv.id === id)
      setPeerReadAt(mine && msgs.length ? String(mine.unread === 0) : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const unsub = api.subscribeRoom('direct', id, load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, typingName])

  useEffect(() => {
    if (!profile) return
    return api.subscribeTyping(`direct-${id}`, profile.id, (name) => {
      setTypingName(name)
      window.clearTimeout(typingTimeout.current)
      typingTimeout.current = window.setTimeout(() => setTypingName(''), 3200)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile) return
    setSending(true)
    try { await api.sendMessage(id, profile.id, text, att) }
    finally { setSending(false) }
  }

  let lastDay = ''
  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/chats')} aria-label="Back">←</button>
        {peer ? <Avatar profile={peer} size={42} showOnline /> : <span className="avatar" style={{ width: 42, height: 42 }}>?</span>}
        <div className="row-main">
          <div className="row-title">{peer ? peer.display_name : 'Conversation'}</div>
          <div className="row-preview">{peer ? (typingName ? 'typing…' : `@${peer.username} · ${fmtLastSeen(peer)}`) : ''}</div>
        </div>
      </div>

      <div style={{ padding: '10px 16px 0' }}><ErrorBox error={error} /></div>

      <div className="messages-scroll" ref={scrollRef}>
        {loading ? (
          <div className="center-loader"><div className="spinner" />Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon">👋</div>
            <h3>No messages yet</h3>
            <p>Say hello to {peer?.display_name || 'start the conversation'} — messages are stored in the database and delivered in realtime.</p>
          </div>
        ) : messages.map((m) => {
          const day = new Date(m.created_at).toDateString()
          const showDay = day !== lastDay; lastDay = day
          const mine = m.sender_id === profile?.id
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day-label">{new Date(m.created_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>}
              <div className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine && peer && <Avatar profile={peer} size={30} />}
                <div className="bubble">
                  <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} />
                  {m.body && <div>{m.body}</div>}
                  <div className="bubble-meta">
                    <span>{fmtClock(m.created_at)}</span>
                    {mine && <span title={peerReadAt ? 'Read' : 'Delivered'}>{peerReadAt ? '✓✓' : '✓'}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="typing-indicator">
        {typingName && <><span className="typing-dots"><span /><span /><span /></span> {typingName} is typing…</>}
      </div>

      <Composer placeholder={`Message ${peer?.display_name || ''}…`} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`direct-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)} />
    </div>
  )
}
