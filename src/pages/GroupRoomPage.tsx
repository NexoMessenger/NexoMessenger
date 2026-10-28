import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Group, GroupMessage, Profile, Reaction } from '../lib/types'
import Composer from '../components/Composer'
import { useI18n } from '../i18n'
import { IconBack, IconGroups, IconChecks, IconHeart } from '../components/icons'
import { AttachmentView, Avatar, GroupAvatar, Modal, UserPicker, fmtClock } from '../components/ui'
import { ReactionBar, REACTION_SET, toggleReactionLocal } from '../components/MessageExtras'

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
  const scrollRef = useRef<HTMLDivElement>(null)
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
      const [g, ms, mems, reacts] = await Promise.all([
        api.getGroup(id), api.listGroupMessages(id, { limit: PAGE }),
        api.getGroupMembers(id), api.listReactions('group', id),
      ])
      if (my !== reqRef.current) return
      setGroup(g); setMessages(ms); setMembers(mems); setReactions(reacts)
      setProfiles(Object.fromEntries(mems.map((m) => [m.profile.id, m.profile])))
      setHasMore(ms.length === PAGE)
      setError('')
    } catch (e) {
      if (my === reqRef.current) setError(e instanceof Error ? e.message : t('error.generic'))
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
      setError(e instanceof Error ? e.message : t('error.generic'))
    } finally { setLoadingEarlier(false) }
  }

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile || sending) return
    setSending(true)
    try { await api.sendGroupMessage(id, profile.id, text, att) }
    finally { setSending(false) }
  }

  const react = async (m: GroupMessage, emoji: string) => {
    if (!profile) return
    setPickerFor(null)
    setReactions((prev) => toggleReactionLocal(prev, 'group', id, m.id, profile.id, emoji))
    try { await api.toggleReaction('group', id, m.id, profile.id, emoji) }
    catch (e) { setError(e instanceof Error ? e.message : t('error.generic')); void load() }
  }

  const act = async (fn: () => Promise<void>) => {
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : t('error.generic')) }
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

      <div className="messages-scroll" ref={scrollRef}>
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
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && sender && <Avatar profile={sender} size={30} />}
              <div className="msg-col">
                <div className="bubble">
                  {!mine && sender && <div className="bubble-sender">{sender.display_name} <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>@{sender.username}</span></div>}
                  <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} duration={m.attachment_duration} />
                  {m.body && <div>{m.body}</div>}
                  <div className="bubble-meta">
                    <button className="react-btn" aria-label={t('reactions.add')} onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>
                      <IconHeart size={12} />
                    </button>
                    <span>{fmtClock(m.created_at)}</span>{mine && <span className="status-read"><IconChecks size={13} /></span>}
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
          )
        })}
      </div>

      <div className="typing-indicator">{typingName && <><span className="typing-dots"><span /><span /><span /></span> {typingName} {t('room.typing')}</>}</div>

      <Composer placeholder={t('groups.messagePlaceholder', { name: group?.name || '' })} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`group-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)} />

      {showInfo && group && profile && (
        <Modal title={t('groups.groupDetails')} onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><GroupAvatar name={group.name} url={group.avatar_url} size={72} /></div>
            <h3 style={{ margin: '12px 0 2px' }}>{group.name}</h3>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{group.is_public ? t('groups.publicGroup') : t('groups.privateGroup')} · {members.length} {t('common.members')}</div>
            {group.description && <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{group.description}</p>}
          </div>
          <div className="section-label">{t('groups.membersLabel')}</div>
          <div className="list">
            {members.map(({ profile: p, role }) => (
              <div key={p.id} className="row-card glass" style={{ cursor: 'default' }}>
                <Avatar profile={p} size={40} showOnline />
                <span className="row-main">
                  <span className="row-title">{p.display_name}</span>
                  <span className="row-preview">@{p.username} · {role}</span>
                </span>
                {canManage && p.id !== group.owner_id && p.id !== profile.id && (
                  <span style={{ display: 'flex', gap: 6 }}>
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
