import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Message, Profile, Reaction } from '../lib/types'
import Composer from '../components/Composer'
import { useI18n } from '../i18n'
import { IconBack, IconChats, IconChecks, IconHeart } from '../components/icons'
import { AttachmentView, Avatar, fmtClock, fmtLastSeen, errText } from '../components/ui'
import { ReactionBar, REACTION_SET, toggleReactionLocal } from '../components/MessageExtras'

const PAGE = 60

export default function ChatRoomPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const [peer, setPeer] = useState<Profile | null>(null)
  const [peerReadAt, setPeerReadAt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingName, setTypingName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<number>()
  const reqRef = useRef(0)
  const prependingRef = useRef(false)

  /** Stale-protected loader: only the newest request may touch state. */
  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    const my = ++reqRef.current
    try {
      const [msgs, p, reacts, readAt] = await Promise.all([
        api.listMessages(id, { limit: PAGE }),
        api.getDirectPeer(id, profile.id),
        api.listReactions('direct', id),
        api.getPeerLastRead(id, profile.id),
      ])
      if (my !== reqRef.current) return
      setMessages(msgs); setPeer(p); setReactions(reacts); setPeerReadAt(readAt)
      setHasMore(msgs.length === PAGE)
      setError('')
    } catch (e) {
      if (my === reqRef.current) setError(errText(e, t))
    } finally {
      if (my === reqRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  useEffect(() => {
    load()
    const unsub = api.subscribeRoom('direct', id, () => { void load() })
    return () => { reqRef.current++; unsub() }
  }, [load, id])

  // Mark read only as a reaction to *new incoming messages* (never inside the
  // realtime loader) — combined with the guarded api.markDirectRead this
  // breaks the load -> mark -> emit -> load feedback loop that froze chats.
  useEffect(() => {
    if (!profile || !messages.length) return
    if (messages[messages.length - 1].sender_id !== profile.id) {
      api.markDirectRead(id, profile.id).catch(() => undefined)
    }
  }, [messages, id, profile?.id])

  const lastMsgId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (prependingRef.current) { prependingRef.current = false; return }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lastMsgId, typingName])

  useEffect(() => {
    if (!profile) return
    return api.subscribeTyping(`direct-${id}`, profile.id, (name) => {
      setTypingName(name)
      window.clearTimeout(typingTimeout.current)
      typingTimeout.current = window.setTimeout(() => setTypingName(''), 3200)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  const loadEarlier = async () => {
    if (!messages.length || loadingEarlier) return
    setLoadingEarlier(true)
    const el = scrollRef.current
    const prevH = el?.scrollHeight || 0
    try {
      const older = await api.listMessages(id, { limit: PAGE, before: messages[0].created_at })
      prependingRef.current = true
      setMessages((prev) => [...older, ...prev])
      setHasMore(older.length === PAGE)
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH })
    } catch (e) {
      setError(errText(e, t))
    } finally { setLoadingEarlier(false) }
  }

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile || sending) return
    setSending(true)
    try { await api.sendMessage(id, profile.id, text, att) }
    finally { setSending(false) }
  }

  const react = async (m: Message, emoji: string) => {
    if (!profile) return
    setPickerFor(null)
    setReactions((prev) => toggleReactionLocal(prev, 'direct', id, m.id, profile.id, emoji))
    try { await api.toggleReaction('direct', id, m.id, profile.id, emoji) }
    catch (e) { setError(errText(e, t)); void load() }
  }

  const myLastOwn = [...messages].reverse().find((m) => m.sender_id === profile?.id)
  const myLastRead = Boolean(myLastOwn && peerReadAt && peerReadAt >= myLastOwn.created_at)

  let lastDay = ''
  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={18} /></button>
        {peer ? <Avatar profile={peer} size={42} showOnline /> : <span className="avatar" style={{ width: 42, height: 42 }}>?</span>}
        <div className="row-main">
          <div className="row-title">{peer ? peer.display_name : t('room.conversation')}</div>
          <div className="row-preview">{peer ? (typingName ? t('room.typingShort') : `@${peer.username} · ${fmtLastSeen(peer, { online: t('common.online'), lastSeen: t('room.lastSeen') }, locale)}`) : ''}</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px 0' }}>
          <div className="error-box" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button className="btn btn-sm" onClick={() => void load()}>{t('common.retry')}</button>
          </div>
        </div>
      )}

      <div className="messages-scroll" ref={scrollRef}>
        {hasMore && !loading && (
          <button className="load-earlier-btn" onClick={loadEarlier} disabled={loadingEarlier}>
            {loadingEarlier ? t('common.loading') : t('room.loadEarlier')}
          </button>
        )}
        {loading ? (
          <div className="center-loader"><div className="spinner" />{t('room.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon"><IconChats size={30} /></div>
            <h3>{t('room.noMessages')}</h3>
            <p>{t('room.sayHelloTo')}</p>
          </div>
        ) : messages.map((m) => {
          const day = new Date(m.created_at).toDateString()
          const showDay = day !== lastDay; lastDay = day
          const mine = m.sender_id === profile?.id
          const isRead = mine && m.id === myLastOwn?.id && myLastRead
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day-label">{new Date(m.created_at).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</div>}
              <div className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine && peer && <Avatar profile={peer} size={30} />}
                <div className="msg-col">
                  <div className="bubble">
                    <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} duration={m.attachment_duration} />
                    {m.body && <div>{m.body}</div>}
                    <div className="bubble-meta">
                      <button className="react-btn" aria-label={t('reactions.add')} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                        <IconHeart size={12} />
                      </button>
                      <span>{fmtClock(m.created_at)}</span>
                      {mine && <span className={isRead ? 'status-read' : 'status-sent'}><IconChecks size={14} /></span>}
                    </div>
                  </div>
                  <ReactionBar reactions={reactions.filter((r) => r.message_id === m.id)} meId={profile?.id || ''} onToggle={(e) => react(m, e)} />
                  {pickerFor === m.id && (
                    <div className="reaction-picker glass" role="menu" aria-label={t('reactions.add')}>
                      {REACTION_SET.map((e) => (
                        <button key={e} className="reaction-pick" onClick={() => react(m, e)} aria-label={e}>{e}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="typing-indicator">
        {typingName && <><span className="typing-dots"><span /><span /><span /></span> {typingName} {t('room.typing')}</>}
      </div>

      <Composer placeholder={`${t('composer.message')} ${peer?.display_name || ''}…`} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`direct-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)} />
    </div>
  )
}
