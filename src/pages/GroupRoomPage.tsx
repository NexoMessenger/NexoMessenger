import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Group, GroupMessage, Profile } from '../lib/types'
import Composer from '../components/Composer'
import { AttachmentView, Avatar, ErrorBox, GroupAvatar, Modal, UserPicker, fmtClock } from '../components/ui'

export default function GroupRoomPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<{ profile: Profile; role: string }[]>([])
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingName, setTypingName] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [addPick, setAddPick] = useState<Profile[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<number>()

  const myRole = members.find((m) => m.profile.id === profile?.id)?.role
  const canManage = myRole === 'owner' || myRole === 'admin'

  const load = async () => {
    if (!profile) return
    try {
      const [g, ms, mems] = await Promise.all([api.getGroup(id), api.listGroupMessages(id), api.getGroupMembers(id)])
      setGroup(g); setMessages(ms); setMembers(mems); setError('')
      setProfiles(Object.fromEntries(mems.map((m) => [m.profile.id, m.profile])))
      await api.markGroupRead(id, profile.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load group') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const unsub = api.subscribeRoom('group', id, load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages.length, typingName])

  useEffect(() => {
    if (!profile) return
    return api.subscribeTyping(`group-${id}`, profile.id, (name) => {
      setTypingName(name)
      window.clearTimeout(typingTimeout.current)
      typingTimeout.current = window.setTimeout(() => setTypingName(''), 3200)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile) return
    setSending(true)
    try { await api.sendGroupMessage(id, profile.id, text, att) } finally { setSending(false) }
  }

  const act = async (fn: () => Promise<void>) => {
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Action failed') }
  }

  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/groups')} aria-label="Back">←</button>
        {group && <GroupAvatar name={group.name} url={group.avatar_url} size={42} />}
        <div className="row-main">
          <div className="row-title">{group?.name || 'Group'}</div>
          <div className="row-preview">{typingName ? `${typingName} is typing…` : `${members.length} members · ${group?.is_public ? 'Public' : 'Private'}`}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setShowInfo(true)}>Details</button>
      </div>

      <div style={{ padding: '10px 16px 0' }}><ErrorBox error={error} /></div>

      <div className="messages-scroll" ref={scrollRef}>
        {loading ? <div className="center-loader"><div className="spinner" />Loading messages…</div>
        : messages.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon">👥</div><h3>No group messages yet</h3>
            <p>Start the conversation — every member will receive it in realtime.</p>
          </div>
        ) : messages.map((m) => {
          const mine = m.sender_id === profile?.id
          const sender = profiles[m.sender_id]
          return (
            <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
              {!mine && sender && <Avatar profile={sender} size={30} />}
              <div className="bubble">
                {!mine && sender && <div className="bubble-sender">{sender.display_name} <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>@{sender.username}</span></div>}
                <AttachmentView url={m.attachment_url} name={m.attachment_name} type={m.attachment_type} />
                {m.body && <div>{m.body}</div>}
                <div className="bubble-meta"><span>{fmtClock(m.created_at)}</span>{mine && <span>✓</span>}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="typing-indicator">{typingName && <><span className="typing-dots"><span /><span /><span /></span> {typingName} is typing…</>}</div>

      <Composer placeholder={`Message ${group?.name || 'group'}…`} sending={sending}
        onSend={send} onTyping={() => profile && api.sendTyping(`group-${id}`, profile)}
        upload={(f) => api.uploadFile(f, profile!.id)} />

      {showInfo && group && profile && (
        <Modal title="Group details" onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><GroupAvatar name={group.name} url={group.avatar_url} size={72} /></div>
            <h3 style={{ margin: '12px 0 2px' }}>{group.name}</h3>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{group.is_public ? 'Public group' : 'Private group'} · {members.length} members</div>
            {group.description && <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{group.description}</p>}
          </div>
          <div className="section-label">Members</div>
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
                      {role === 'admin' ? 'Demote' : 'Make admin'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => act(() => api.removeGroupMember(id, p.id))}>Remove</button>
                  </span>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <>
              <div className="section-label">Add members</div>
              <UserPicker meId={profile.id} selected={addPick} exclude={members.map((m) => m.profile.id)}
                onToggle={(p) => setAddPick((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p])} />
              <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!addPick.length}
                onClick={() => act(async () => { for (const p of addPick) await api.addGroupMember(id, p.id); setAddPick([]) })}>
                Add selected members
              </button>
            </>
          )}
          {myRole !== 'owner' && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 16 }}
              onClick={() => act(async () => { await api.removeGroupMember(id, profile.id); navigate('/groups') })}>
              Leave group
            </button>
          )}
          {myRole === 'owner' && <p style={{ color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center', marginTop: 14 }}>You are the group owner. Owners manage members and roles.</p>}
        </Modal>
      )}
    </div>
  )
}
