import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Group, GroupMessage, Profile, Reaction } from '../lib/types'
import Composer from '../components/Composer'
import { useI18n } from '../i18n'
import { IconBack, IconGroups, IconChecks, IconClose, IconEdit, IconHeart, IconReply } from '../components/icons'
import { AttachmentView, Avatar, GroupAvatar, Modal, ProfileName, UserPicker, fmtClock, errText } from '../components/ui'
import { AnimatedEmojiBody, ReactionBar, ReactionBursts, REACTION_SET, toggleReactionLocal, type BurstSpec } from '../components/MessageExtras'
import { PREMIUM_REACTIONS, isPremiumActive } from '../lib/premiumData'
import { ForwardPicker, MessageContextMenu, copyText, useMessageMenu, type MenuTarget, type MessageAction } from '../components/MessageMenu'

const PAGE = 60

export default function GroupRoomPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<{ profile: Profile; role: string }[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [hasMore, setHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingName, setTypingName] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [addPick, setAddPick] = useState<Profile[]>([])
  const [memberError, setMemberError] = useState(false)
  const [menuTarget, setMenuTarget] = useState<MenuTarget<GroupMessage> | null>(null)
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null)
  const [editing, setEditing] = useState<GroupMessage | null>(null)
  const [forwardMsg, setForwardMsg] = useState<GroupMessage | null>(null)
  const [bursts, setBursts] = useState<BurstSpec[]>([])
  const [toast, setToast] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number>()
  const typingTimeout = useRef<number>()
  const reqRef = useRef(0)
  const prependingRef = useRef(false)

  const myRole = members.find((m) => m.profile.id === profile?.id)?.role
  const canManage = myRole === 'owner' || myRole === 'admin'

  /** Stale-protected loader: only the newest request may touch state. */
  const load = useCallback(async () => {
    if (!profile) { setLoading(false); return }
    const my = ++reqRef.current
    try {
      // Members and reactions are auxiliary: if either request fails (e.g.
      // migration 003 not applied yet), the room and member list must still
      // render — never blank the whole screen for one failing sub-request.
      const [g, ms, mems] = await Promise.all([
        api.getGroup(id), api.listGroupMessages(id, { limit: PAGE }),
        api.getGroupMembers(id).catch(() => { if (my === reqRef.current) setMemberError(true); return [] as { profile: Profile; role: string }[] }),
      ])
      const reacts = await api.listReactions('group', id).catch(() => [] as Reaction[])
      if (my !== reqRef.current) return
      setGroup(g); setMessages(ms); setMembers(mems); setReactions(reacts)
      if (mems.length) setMemberError(false)
      setProfiles(Object.fromEntries(mems.map((m) => [m.profile.id, m.profile])))
      setHasMore(ms.length === PAGE)
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
    const unsub = api.subscribeRoom('group', id, () => { void load() })
    return () => { reqRef.current++; unsub() }
  }, [load, id])

  // Mark read only on new incoming messages (breaks the realtime loop).
  useEffect(() => {
    if (!profile || !messages.length) return
    if (messages[messages.length - 1].sender_id !== profile.id) {
      api.markGroupRead(id, profile.id).catch(() => undefined)
    }
  }, [messages, id, profile?.id])

  const lastMsgId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (prependingRef.current) { prependingRef.current = false; return }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lastMsgId, typingName])

  useEffect(() => {
    if (!profile) return
    return api.subscribeTyping(`group-${id}`, profile.id, (name) => {
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
      const older = await api.listGroupMessages(id, { limit: PAGE, before: messages[0].created_at })
      prependingRef.current = true
      setMessages((prev) => [...older, ...prev])
      setHasMore(older.length === PAGE)
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH })
    } catch (e) {
      setError(errText(e, t))
    } finally { setLoadingEarlier(false) }
  }

  const bindMenu = useMessageMenu<GroupMessage>((tgt) => { setPickerFor(null); setMenuTarget(tgt) })

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

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile || sending) return
    setSending(true)
    try {
      if (editing) {
        try {
          await api.editMessage('group', id, editing.id, profile.id, text)
        } catch (e) {
          setError(errText(e, t))
          throw e // let the composer restore the draft
        }
        setEditing(null)
        void load()
      } else {
        await api.sendGroupMessage(id, profile.id, text, att, replyTo?.id)
        setReplyTo(null)
      }
    } finally { setSending(false) }
  }

  const react = async (m: GroupMessage, emoji: string, pt?: { x: number; y: number }) => {
    if (!profile) return
    setPickerFor(null)
    const prev0 = reactions.find((r) => r.message_id === m.id && r.user_id === profile.id)
    const adding = !prev0 || prev0.emoji !== emoji
    setReactions((prev) => toggleReactionLocal(prev, 'group', id, m.id, profile.id, emoji))
    if (adding && pt) spawnBurst(pt.x, pt.y, emoji)
    try { await api.toggleReaction('group', id, m.id, profile.id, emoji) }
    catch (e) { setError(errText(e, t)); void load() }
  }

  const doDelete = async (m: GroupMessage) => {
    if (!profile) return
    setMessages((prev) => prev.filter((x) => x.id !== m.id))
    try { await api.deleteMessage('group', id, m.id, profile.id) }
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

  const act = async (fn: () => Promise<void>) => {
    try { await fn(); await load() } catch (e) { setError(errText(e, t)) }
  }

  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/groups')} aria-label={t('common.back')}><IconBack size={18} /></button>
        {group && <GroupAvatar name={group.name} url={group.avatar_url} size={42} />}
        <div className="row-main">
          <div className="row-title">{group?.name || 'Group'}</div>
          <div className="row-preview">{typingName ? `${typingName} ${t('room.typing')}` : `${members.length} ${t('common.members')} · ${group?.is_public ? t('common.public') : t('common.private')}`}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setShowInfo(true)}>{t('groups.details')}</button>
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
        {loading ? <div className="center-loader"><div className="spinner" />{t('room.loading')}</div>
        : messages.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon"><IconGroups size={30} /></div><h3>{t('room.noMessages')}</h3>
            <p>{t('groups.noMessagesText')}</p>
          </div>
        ) : messages.map((m) => {
          const mine = m.sender_id === profile?.id
          const sender = profiles[m.sender_id] || members.find((x) => x.profile.id === m.sender_id)?.profile
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`} {...bindMenu(m)}>
              {!mine && sender && <Avatar profile={sender} size={30} />}
              <div className="msg-col">
                <div className="bubble">
                  {!mine && sender && <div className="bubble-sender"><ProfileName profile={sender} /> <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>@{sender.username}</span></div>}
                  {m.reply_to && (() => {
                    const q = messages.find((x) => x.id === m.reply_to)
                    const qp = q ? profiles[q.sender_id] : undefined
                    return (
                      <div className="msg-quote">
                        <span className="msg-quote-name">{q ? (q.sender_id === profile?.id ? t('common.you') : qp?.display_name || '') : ''}</span>
                        <span className="msg-quote-text">{q ? (q.body || q.attachment_name || t('common.attachment')) : t('msg.originalUnavailable')}</span>
                      </div>
                    )
                  })()}
                  <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} duration={m.attachment_duration} />
                  {m.body && <div><AnimatedEmojiBody body={m.body} /></div>}
                  <div className="bubble-meta">
                    {m.edited_at ? <span className="edited-mark">{t('msg.edited')}</span> : null}
                    <button className="react-btn" aria-label={t('reactions.add')} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                      <IconHeart size={12} />
                    </button>
                    <span>{fmtClock(m.created_at)}</span>{mine && <span className="status-read"><IconChecks size={13} /></span>}
                  </div>
                </div>
                <ReactionBar reactions={reactions.filter((r) => r.message_id === m.id)} meId={profile?.id || ''} onToggle={(e, ev) => react(m, e, { x: ev.clientX, y: ev.clientY })} />
                {pickerFor === m.id && (
                  <div className="reaction-picker glass" role="menu" aria-label={t('reactions.add')}>
                    {[...REACTION_SET, ...(isPremiumActive(profile) ? PREMIUM_REACTIONS : [])].map((e) => (
                      <button key={e} className="reaction-pick" onClick={(ev) => react(m, e, { x: ev.clientX, y: ev.clientY })} aria-label={e}>{e}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="typing-indicator">{typingName && <><span className="typing-dots"><span /><span /><span /></span> {typingName} {t('room.typing')}</>}</div>

      {(replyTo || editing) && (
        <div className="composer-banner">
          {editing ? <IconEdit size={15} /> : <IconReply size={15} />}
          <div className="composer-banner-main">
            <span className="composer-banner-name">{editing ? t('msg.editing') : `${t('msg.reply')} · ${replyTo?.sender_id === profile?.id ? t('common.you') : profiles[replyTo?.sender_id || '']?.display_name || ''}`}</span>
            <span className="composer-banner-text">{(editing || replyTo)?.body || (editing || replyTo)?.attachment_name || ''}</span>
          </div>
          <button className="icon-btn" onClick={() => { setReplyTo(null); setEditing(null) }} aria-label={t('common.cancel')}><IconClose size={15} /></button>
        </div>
      )}

      <Composer key={id} placeholder={t('groups.messagePlaceholder', { name: group?.name || '' })} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`group-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)}
        premiumEmojiEnabled={isPremiumActive(profile)}
        onPremiumEmojiLocked={() => navigate('/premium')}
        initialTextKey={editing?.id || ''} initialText={editing?.body || ''} />

      {menuTarget && profile && (
        <MessageContextMenu target={menuTarget} mine={menuTarget.msg.sender_id === profile.id}
          premiumReactions={isPremiumActive(profile)}
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

      {showInfo && group && profile && (
        <Modal title={t('groups.groupDetails')} onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><GroupAvatar name={group.name} url={group.avatar_url} size={72} /></div>
            <h3 style={{ margin: '12px 0 2px' }}>{group.name}</h3>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{group.is_public ? t('groups.publicGroup') : t('groups.privateGroup')} · {members.length} {t('common.members')}</div>
            {group.description && <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{group.description}</p>}
          </div>
          <div className="section-label">{t('groups.membersLabel')} · {members.length}</div>
          {memberError && members.length === 0 && (
            <div className="error-box" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{t('groups.membersError')}</span>
              <button className="btn btn-sm" onClick={() => void load()}>{t('common.retry')}</button>
            </div>
          )}
          {!memberError && members.length === 0 && <p className="members-empty">{t('groups.noMembers')}</p>}
          <div className="list member-list">
            {members.map(({ profile: p, role }) => (
              <div key={p.id} className="row-card glass member-row">
                <span className="member-main" role="button" tabIndex={0} title={t('profile.view')}
                  onClick={() => navigate(`/user/${p.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/user/${p.id}`) }}>
                  <Avatar profile={p} size={40} showOnline />
                  <span className="row-main">
                    <span className="row-title"><ProfileName profile={p} /></span>
                    <span className="row-preview">@{p.username}</span>
                  </span>
                </span>
                <span className={`role-badge role-${role}`}>{t(role === 'owner' ? 'roles.owner' : role === 'admin' ? 'roles.admin' : 'roles.member')}</span>
                {canManage && p.id !== group.owner_id && p.id !== profile.id && (
                  <span className="member-actions">
                    <button className="btn btn-sm" onClick={() => act(() => api.setGroupRole(id, p.id, role === 'admin' ? 'member' : 'admin'))}>
                      {role === 'admin' ? t('groups.demote') : t('groups.makeAdmin')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => act(() => api.removeGroupMember(id, p.id))}>{t('common.remove')}</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <>
              <div className="section-label">{t('groups.addMembers')}</div>
              <UserPicker meId={profile.id} selected={addPick} exclude={members.map((m) => m.profile.id)}
                onToggle={(p) => setAddPick((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p])} />
              <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!addPick.length}
                onClick={() => act(async () => { for (const p of addPick) await api.addGroupMember(id, p.id); setAddPick([]) })}>
                {t('groups.addSelected')}
              </button>
            </>
          )}
          {myRole !== 'owner' && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 16 }}
              onClick={() => act(async () => { await api.removeGroupMember(id, profile.id); navigate('/groups') })}>
              {t('groups.leave')}
            </button>
          )}
          {myRole === 'owner' && <p style={{ color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>{t('groups.ownerNote')}</p>}
        </Modal>
      )}
    </div>
  )
}
