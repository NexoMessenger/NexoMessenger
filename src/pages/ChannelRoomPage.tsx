import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Channel, ChannelPost, Profile } from '../lib/types'
import Composer from '../components/Composer'
import { AttachmentView, Avatar, ErrorBox, GroupAvatar, Modal, fmtClock } from '../components/ui'

export default function ChannelRoomPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [channel, setChannel] = useState<Channel | null>(null)
  const [posts, setPosts] = useState<ChannelPost[]>([])
  const [members, setMembers] = useState<{ profile: Profile; role: string; can_post: boolean }[]>([])
  const [owner, setOwner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const me = members.find((m) => m.profile.id === profile?.id)
  const isOwner = channel?.owner_id === profile?.id
  const canPost = Boolean(isOwner || (me && (me.role !== 'subscriber' || me.can_post)))
  const subscribed = Boolean(me) || isOwner

  const load = async () => {
    if (!profile) return
    try {
      const [ch, ps, mems] = await Promise.all([api.getChannel(id), api.listPosts(id), api.getChannelMembers(id)])
      setChannel(ch); setPosts(ps); setMembers(mems); setError('')
      if (ch) setOwner(await api.getProfile(ch.owner_id))
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load channel') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const unsub = api.subscribeRoom('channel', id, load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [posts.length])

  const send = async (text: string, att?: AttachmentInfo) => {
    if (!profile) return
    setSending(true)
    try { await api.sendPost(id, profile.id, text, att) } finally { setSending(false) }
  }

  const toggleSubscribe = async () => {
    if (!profile) return
    try {
      if (subscribed) await api.unsubscribeChannel(id, profile.id)
      else await api.subscribeChannel(id, profile.id)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Subscription failed') }
  }

  const authorOf = (pid: string) => members.find((m) => m.profile.id === pid)?.profile || (owner?.id === pid ? owner : null)

  return (
    <div className="room-wrap">
      <div className="room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/channels')} aria-label="Back">←</button>
        {channel && <GroupAvatar name={channel.name} url={channel.avatar_url} size={42} />}
        <div className="row-main">
          <div className="row-title">{channel?.name || 'Channel'}</div>
          <div className="row-preview">{members.length} subscribers · {channel?.is_public ? 'Public' : 'Private'} channel</div>
        </div>
        {!isOwner && (
          <button className={`btn btn-sm ${subscribed ? '' : 'btn-primary'}`} onClick={toggleSubscribe}>
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => setShowInfo(true)}>Info</button>
      </div>

      <div style={{ padding: '10px 16px 0' }}><ErrorBox error={error} /></div>

      <div className="messages-scroll" ref={scrollRef}>
        {loading ? <div className="center-loader"><div className="spinner" />Loading posts…</div>
        : posts.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon">📣</div><h3>No posts yet</h3>
            <p>{canPost ? 'Publish the first post for your subscribers.' : 'The channel owner has not published anything yet.'}</p>
          </div>
        ) : posts.map((post) => {
          const author = authorOf(post.author_id)
          return (
            <div key={post.id} className="msg-row theirs" style={{ maxWidth: '88%' }}>
              {author && <Avatar profile={author} size={30} />}
              <div className="bubble">
                {author && <div className="bubble-sender">{author.display_name} <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>@{author.username}</span></div>}
                <AttachmentView url={post.attachment_url} name={post.attachment_name} type={post.attachment_type} />
                {post.body && <div>{post.body}</div>}
                <div className="bubble-meta"><span>{new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {fmtClock(post.created_at)}</span></div>
              </div>
            </div>
          )
        })}
      </div>

      {canPost ? (
        <Composer placeholder={`Broadcast to ${channel?.name || 'channel'}…`} sending={sending}
          onSend={send} onTyping={() => undefined} upload={(f) => api.uploadFile(f, profile!.id)} />
      ) : (
        <div style={{ padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'rgba(8,8,12,0.55)' }}>
          {subscribed ? 'Only the channel owner, admins and authorized publishers can post here.' : 'Subscribe to receive new posts from this channel.'}
        </div>
      )}

      {showInfo && channel && (
        <Modal title="Channel info" onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><GroupAvatar name={channel.name} url={channel.avatar_url} size={72} /></div>
            <h3 style={{ margin: '12px 0 2px' }}>{channel.name}</h3>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{channel.is_public ? 'Public' : 'Private'} · {members.length} subscribers</div>
            {channel.description && <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{channel.description}</p>}
            {owner && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Owner: {owner.display_name} (@{owner.username})</p>}
          </div>
          {(isOwner || me?.role === 'admin') && (
            <>
              <div className="section-label">Publishing permissions</div>
              <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Grant subscribers the right to publish posts. This is enforced on the backend — the composer alone is never trusted.</p>
              <div className="list">
                {members.filter((m) => m.profile.id !== channel.owner_id).map(({ profile: p, role, can_post }) => (
                  <div key={p.id} className="row-card glass" style={{ cursor: 'default' }}>
                    <Avatar profile={p} size={38} />
                    <span className="row-main">
                      <span className="row-title">{p.display_name}</span>
                      <span className="row-preview">@{p.username} · {role}{can_post ? ' · can post' : ''}</span>
                    </span>
                    <button className={`btn btn-sm ${can_post ? '' : 'btn-primary'}`}
                      onClick={async () => { try { await api.setChannelPoster(id, p.id, !can_post); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Failed') } }}>
                      {can_post ? 'Revoke posting' : 'Allow posting'}
                    </button>
                  </div>
                ))}
                {members.length <= 1 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No subscribers yet.</p>}
              </div>
            </>
          )}
          {!isOwner && subscribed && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={async () => { await toggleSubscribe(); setShowInfo(false) }}>
              Unsubscribe
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
