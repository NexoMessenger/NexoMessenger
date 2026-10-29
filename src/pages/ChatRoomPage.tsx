import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Message, Profile, Reaction } from '../lib/types'
import Composer from '../components/Composer'
import { useI18n } from '../i18n'
import { IconBack, IconChats, IconChecks, IconClose, IconEdit, IconHeart, IconReply } from '../components/icons'
import { AttachmentView, Avatar, fmtClock, fmtLastSeen, errText } from '../components/ui'
import { ReactionBar, ReactionBursts, REACTION_SET, toggleReactionLocal, type BurstSpec } from '../components/MessageExtras'
import { ForwardPicker, MessageContextMenu, copyText, useMessageMenu, type MenuTarget, type MessageAction } from '../components/MessageMenu'

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
  const [menuTarget, setMenuTarget] = useState<MenuTarget<Message> | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null)
  const [bursts, setBursts] = useState<BurstSpec[]>([])
  const [toast, setToast] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number>()
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

  const bindMenu = useMessageMenu<Message>((tgt) => { setPickerFor(null); setMenuTarget(tgt) })

  const showToast = (text: string) => {
    setToast(text)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 1900)
  }

  const spawnBurst = (x: number, y: number, emoji: string) => {
    const burstId = Date.now() + Math.random()
    setBursts((p) => [...p.slice(-3), { id: burstId, x, y, emoji }])
    window.setTimeout(() => setBursts((p) => p.filter((b) => b.id !== burstId)), 820)
  }

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
    try {
      if (editing) {
        try {
          await api.editMessage('direct', id, editing.id, profile.id, text)
        } catch (e) {
          setError(errText(e, t))
          throw e // let the composer restore the draft
        }
        setEditing(null)
        void load()
      } else {
        await api.sendMessage(id, profile.id, text, att, replyTo?.id)
        setReplyTo(null)
      }
    } finally { setSending(false) }
  }

  const react = async (m: Message, emoji: string, pt?: { x: number; y: number }) => {
    if (!profile) return
    setPickerFor(null)
    const prev0 = reactions.find((r) => r.message_id === m.id && r.user_id === profile.id)
    const adding = !prev0 || prev0.emoji !== emoji
    setReactions((prev) => toggleReactionLocal(prev, 'direct', id, m.id, profile.id, emoji))
    if (adding && pt) spawnBurst(pt.x, pt.y, emoji)
    try { await api.toggleReaction('direct', id, m.id, profile.id, emoji) }
    catch (e) { setError(errText(e, t)); void load() }
  }

  const doDelete = async (m: Message) => {
    if (!profile) return
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    try { await api.deleteMessage('direct', id, m.id, profile.id) }
    catch (e) { setError(errText(e, t)); void load() }
  }

  const handleMenuAction = (action: MessageAction) => {
    const m = menuTarget?.msg
    setMenuTarget(null)
    if (!m) return
    if (action === 'reply') setReplyTo(m)
    else if (action === 'edit') setEditing(m)
    else if (action === 'forward') setForwardMsg(m)
    else if (action === 'delete') void doDelete(m)
  }

  const myLastOwn = [...messages].reverse().find((m) => m.sender_id === profile?.id)
  const myLastRead = Boolean(myLastOwn && peerReadAt && peerReadAt >= myLastOwn.created_at)

  let lastDay = ''
  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={18} /></button>
        <button className="room-head-profile" onClick={() => peer && navigate(`/user/${peer.id}`)} aria-label={t('profile.view')}>
          {peer ? <Avatar profile={peer} size={42} showOnline /> : <span className="avatar" style={{ width: 42, height: 42 }}>?</span>}
          <span className="row-main">
            <span className="row-title">{peer ? peer.display_name : t('room.conversation')}</span>
            <span className="row-preview">{peer ? (typingName ? t('room.typingShort') : `@${peer.username} · ${fmtLastSeen(peer, { online: t('common.online'), lastSeen: t('room.lastSeen') }, locale)}`) : ''}</span>
          </span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px 0' }}>
          <div className="error-box" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button className="btn btn-sm" onClick={() => void load()}>{t('common.retry')}</button>
          </div>
        </div>
      )}

      <div className="messages-scroll" ref={scrollRef} onScroll={() => { if (menuTarget) setMenuTarget(null) }}>
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
              <div className={`msg-row ${mine ? 'mine' : 'theirs'}`} {...bindMenu(m)}>
                {!mine && peer && (
                  <span className="msg-avatar-btn" onClick={() => peer && navigate(`/user/${peer.id}`)} role="button" aria-label={t('profile.view')}>
                    <Avatar profile={peer} size={30} />
                  </span>
                )}
                <div className="msg-col">
                  <div className="bubble">
                    {m.reply_to && (() => {
                      const q = messages.find((x) => x.id === m.reply_to)
                      return (
                        <div className="msg-quote">
                          <span className="msg-quote-name">{q ? (q.sender_id === profile?.id ? t('common.you') : peer?.display_name || '') : ''}</span>
                          <span className="msg-quote-text">{q ? (q.body || q.attachment_name || t('common.attachment')) : t('msg.originalUnavailable')}</span>
                        </div>
                      )
                    })()}
                    <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} duration={m.attachment_duration} />
                    {m.body && <div>{m.body}</div>}
                    <div className="bubble-meta">
                      {m.edited_at ? <span className="edited-mark">{t('msg.edited')}</span> : null}
                      <button className="react-btn" aria-label={t('reactions.add')} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                        <IconHeart size={12} />
                      </button>
                      <span>{fmtClock(m.created_at)}</span>
                      {mine && <span className={isRead ? 'status-read' : 'status-sent'}><IconChecks size={14} /></span>}
                    </div>
                  </div>
                  <ReactionBar reactions={reactions.filter((r) => r.message_id === m.id)} meId={profile?.id || ''} onToggle={(e, ev) => react(m, e, { x: ev.clientX, y: ev.clientY })} />
                  {pickerFor === m.id && (
                    <div className="reaction-picker glass" role="menu" aria-label={t('reactions.add')}>
                      {REACTION_SET.map((e) => (
                        <button key={e} className="reaction-pick" onClick={(ev) => react(m, e, { x: ev.clientX, y: ev.clientY })} aria-label={e}>{e}</button>
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

      {(replyTo || editing) && (
        <div className="composer-banner">
          {editing ? <IconEdit size={15} /> : <IconReply size={15} />}
          <div className="composer-banner-main">
            <span className="composer-banner-name">{editing ? t('msg.editing') : `${t('msg.reply')} · ${replyTo?.sender_id === profile?.id ? t('common.you') : peer?.display_name || ''}`}</span>
            <span className="composer-banner-text">{(editing || replyTo)?.body || (editing || replyTo)?.attachment_name || ''}</span>
          </div>
          <button className="icon-btn" onClick={() => { setReplyTo(null); setEditing(null) }} aria-label={t('common.cancel')}><IconClose size={15} /></button>
        </div>
      )}

      <Composer placeholder={`${t('composer.message')} ${peer?.display_name || ''}…`} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`direct-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)}
        initialTextKey={editing?.id || ''} initialText={editing?.body || ''} />

      {menuTarget && profile && (
        <MessageContextMenu target={menuTarget} mine={menuTarget.msg.sender_id === profile.id}
          myEmoji={reactions.find((r) => r.message_id === menuTarget.msg.id && r.user_id === profile.id)?.emoji ?? null}
          onReact={(emoji, at) => { const m = menuTarget.msg; setMenuTarget(null); void react(m, emoji, at) }}
          onCopy={() => { const m = menuTarget.msg; setMenuTarget(null); void copyText(m.body).then((ok) => { if (ok) showToast(t('msg.copied')) }) }}
          onAction={handleMenuAction}
          onClose={() => setMenuTarget(null)} />
      )}

      {forwardMsg && profile && (
        <ForwardPicker meId={profile.id} onClose={() => setForwardMsg(null)}
          onPick={async ({ kind, id: targetId }) => {
            const m = forwardMsg
            const att = m.attachment_url ? { url: m.attachment_url, name: m.attachment_name, type: m.attachment_type, duration: m.attachment_duration } : undefined
            if (kind === 'direct') await api.sendMessage(targetId, profile.id, m.body, att)
            else await api.sendGroupMessage(targetId, profile.id, m.body, att)
            setForwardMsg(null)
            showToast(t('msg.forwarded'))
          }} />
      )}


      <ReactionBursts bursts={bursts} />
      {toast && <div className="msg-toast" role="status">{toast}</div>}
    </div>
  )
}
