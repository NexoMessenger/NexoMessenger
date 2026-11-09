import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { AttachmentInfo, Channel, ChannelPost, ChannelComment, Profile } from '../lib/types'
import Composer from '../components/Composer'
import { ChannelCommentsButton } from '../components/ChannelCommentsButton'
import { useI18n } from '../i18n'
import { IconPlus, IconBack, IconChats, IconGroups, IconChannel, IconSearch, IconChecks, IconSettings } from '../components/icons'
import { AttachmentView, Avatar, ErrorBox, GroupAvatar, Modal, ProfileName, fmtClock, errText } from '../components/ui'
import { AnimatedEmojiBody } from '../components/MessageExtras'
import { isPremiumActive } from '../lib/premiumData'

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
  const [commentsPost, setCommentsPost] = useState<ChannelPost | null>(null)
  const [comments, setComments] = useState<ChannelComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [settingBusy, setSettingBusy] = useState(false)
  const [settingError, setSettingError] = useState('')
  const [businessEdit, setBusinessEdit] = useState(false)
  const [businessForm, setBusinessForm] = useState({ enabled: false, website: '', address: '', hours: '' })
  const { t } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)

  const me = members.find((m) => m.profile.id === profile?.id)
  const isOwner = channel?.owner_id === profile?.id
  const canPost = Boolean(isOwner || (me && (me.role !== 'subscriber' || me.can_post)))
  const subscribed = Boolean(me) || isOwner

  const load = async () => {
    if (!profile) return
    try {
      const [ch, ps, mems] = await Promise.all([api.getChannel(id), api.listPosts(id), api.getChannelMembers(id).catch((e) => { if (e instanceof Error && /access denied/i.test(e.message)) return [] as { profile: Profile; role: string; can_post: boolean }[]; throw e })])
      setChannel(ch); setPosts(ps); setMembers(mems); setError('')
      if (ch) setOwner(await api.getProfile(ch.owner_id))
    } catch (e) { setError(errText(e, t)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    const unsub = api.subscribeRoom('channel', id, load)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.id])

  useEffect(() => {
    if (!commentsPost || api.mode !== 'server') return
    let active = true
    const loadComments = async () => {
      try { const result = await api.listChannelComments(id, commentsPost.id); if (active) { setComments(result); setCommentError('') } }
      catch (e) { if (active) setCommentError(errText(e, t)) }
    }
    setComments([]); setCommentText(''); setCommentError(''); void loadComments()
    const unsub = api.subscribeRoom('channel', id, () => void loadComments())
    return () => { active = false; unsub() }
  }, [id, commentsPost?.id])

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
    } catch (e) { setError(errText(e, t)) }
  }

  const authorOf = (pid: string) => members.find((m) => m.profile.id === pid)?.profile || (owner?.id === pid ? owner : null)

  return (
    <div className="room-wrap channel-room">
      <div className="room-head channel-room-head">
        <button className="icon-btn back-btn-mobile" onClick={() => navigate('/channels')} aria-label={t('common.back')}><IconBack size={18} /></button>
        {channel && <GroupAvatar name={channel.name} url={channel.avatar_url} size={42} />}
        <div className="row-main">
          <div className="row-title">{channel?.name || 'Channel'} {channel?.business?.enabled && <span className="pill pill-accent">{t('channelBusiness.badge')}</span>}</div>
          <div className="row-preview">{subscribed && <>{members.length} {t('common.subscribers')} · </>}{channel?.is_public ? t('common.public') : t('common.private')}</div>
        </div>
        {!isOwner && (
          <button className={`btn btn-sm ${subscribed ? '' : 'btn-primary'}`} onClick={toggleSubscribe}>
            {subscribed ? t('channels.subscribed') : t('channels.subscribe')}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => setShowInfo(true)}>{t('channels.info')}</button>
      </div>

      <div style={{ padding: '10px 16px 0' }}><ErrorBox error={error} /></div>

      <div className="messages-scroll" ref={scrollRef}>
        {channel && <div className="channel-welcome"><div><span className="channel-welcome-kicker">{channel.business?.enabled ? t('channelBusiness.badge') : t('channels.title')}</span><h2>{channel.name}</h2>{channel.description && <p>{channel.description}</p>}</div><button type="button" className="btn btn-sm" onClick={() => setShowInfo(true)}>{t('channels.info')}</button></div>}
        {channel?.business?.enabled && <div className="channel-business-card">
          <strong>{t('channelBusiness.details')}</strong>
          {channel.business.hours && <div><span>{t('channelBusiness.hours')}</span><span>{channel.business.hours}</span></div>}
          {channel.business.address && <div><span>{t('channelBusiness.address')}</span><span>{channel.business.address}</span></div>}
          {channel.business.website && /^https?:\/\//i.test(channel.business.website) && <a href={channel.business.website} target="_blank" rel="noopener noreferrer">{t('channelBusiness.visit')} ↗</a>}
          {!channel.business.hours && !channel.business.address && !channel.business.website && <p>{t('channelBusiness.empty')}</p>}
        </div>}
        {loading ? <div className="center-loader"><div className="spinner" />{t('room.loading')}</div>
        : posts.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%' }}>
            <div className="empty-icon"><IconChannel size={30} /></div><h3>{t('channels.noPosts')}</h3>
            <p>{canPost ? t('channels.noPostsOwner') : t('channels.noPostsSub')}</p>
          </div>
        ) : posts.map((post) => {
          const author = authorOf(post.author_id)
          return (
            <div key={post.id} className="msg-row theirs channel-post">
              {author && <Avatar profile={author} size={30} />}
              <div className="bubble">
                {author && <div className="bubble-sender"><ProfileName profile={author} /> <span style={{ fontWeight: 500, color: 'var(--text-3)' }}>@{author.username}</span></div>}
                <AttachmentView url={post.attachment_url} name={post.attachment_name} type={post.attachment_type} />
                {post.body && <div><AnimatedEmojiBody body={post.body} /></div>}
                <div className="bubble-meta"><span>{new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {fmtClock(post.created_at)}</span></div>
                {api.mode === 'server' && channel && <ChannelCommentsButton enabled={Boolean(channel.comments_enabled)} count={post.comment_count || 0} onOpen={() => setCommentsPost(post)} />}
              </div>
            </div>
          )
        })}
      </div>

      {canPost ? (
        <Composer key={id} placeholder={t('channels.broadcastPlaceholder', { name: channel?.name || '' })} sending={sending}
          onSend={send} onTyping={() => undefined} upload={(f, options) => api.uploadFile(f, profile!.id, options)}
          premiumEmojiEnabled={isPremiumActive(profile)}
          onPremiumEmojiLocked={() => navigate('/premium')} />
      ) : (
        <div style={{ padding: '14px 20px calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'rgba(8,8,12,0.55)' }}>
          {subscribed ? t('channels.readOnly') : t('channels.subscribeToReceive')}
        </div>
      )}

      {commentsPost && channel && <Modal title={t('channelComments.title')} onClose={() => setCommentsPost(null)}>
        <p className="channel-comments-post">{commentsPost.body || commentsPost.attachment_name || t('common.attachment')}</p>
        <p className="channel-comments-post">{t('channelComments.recent')}</p>
        <div className="channel-comments-list" aria-live="polite">
          {comments.length === 0 && <p>{t('channelComments.empty')}</p>}
          {comments.map(comment => <div className="channel-comment" key={comment.id}>
            <div className="channel-comment-head"><strong>{comment.author ? <ProfileName profile={comment.author} /> : t('channelComments.unknown')}</strong><span>{fmtClock(comment.created_at)}</span></div>
            <div className="channel-comment-body">{comment.body}</div>
            {(isOwner || comment.author_id === profile?.id) && <button type="button" className="btn btn-sm" disabled={commentBusy} onClick={async () => {
              if (!window.confirm(t('channelComments.confirmDelete'))) return
              setCommentBusy(true); setCommentError('')
              try { await api.deleteChannelComment(id, commentsPost.id, comment.id); setComments(await api.listChannelComments(id, commentsPost.id)) }
              catch (e) { setCommentError(errText(e, t)) } finally { setCommentBusy(false) }
            }}>{t('channelComments.delete')}</button>}
          </div>)}
        </div>
        <ErrorBox error={commentError} />
        {!channel.comments_enabled ? <div><p>{t('channelComments.closed')}</p>{isOwner && <button type="button" className="btn btn-primary" disabled={settingBusy} onClick={async () => {
          setSettingBusy(true); setCommentError('')
          try { await api.setChannelComments(id, true); setChannel(current => current ? { ...current, comments_enabled: true } : current); await load() }
          catch (e) { setCommentError(errText(e, t)) } finally { setSettingBusy(false) }
        }}>{t('channelComments.openNow')}</button>}</div> : !subscribed ? <p>{t('channelComments.subscribe')}</p> : <form className="channel-comment-form" onSubmit={async event => {
          event.preventDefault(); if (!commentText.trim() || commentBusy) return
          setCommentBusy(true); setCommentError('')
          try { await api.sendChannelComment(id, commentsPost.id, commentText); setCommentText(''); setComments(await api.listChannelComments(id, commentsPost.id)) }
          catch (e) { setCommentError(errText(e, t)) } finally { setCommentBusy(false) }
        }}><textarea className="textarea" rows={2} maxLength={1000} value={commentText} onChange={event => setCommentText(event.target.value)} placeholder={t('channelComments.placeholder')} aria-label={t('channelComments.placeholder')} /><button className="btn btn-primary" disabled={commentBusy || !commentText.trim()} type="submit">{t('channelComments.send')}</button></form>}
      </Modal>}

      {showInfo && channel && (
        <Modal title={t('channels.channelInfo')} onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><GroupAvatar name={channel.name} url={channel.avatar_url} size={72} /></div>
            <h3 style={{ margin: '12px 0 2px' }}>{channel.name}</h3>
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{channel.is_public ? t('common.public') : t('common.private')}{subscribed && <> · {members.length} {t('common.subscribers')}</>}</div>
            {channel.description && <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>{channel.description}</p>}
            {owner && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('common.owner')}: {owner.display_name} (@{owner.username})</p>}
          </div>
          {isOwner && api.mode === 'server' && <div className="channel-business-settings">
            <div className="channel-business-settings-head"><div><strong>{t('channelBusiness.settings')}</strong><p>{t('channelBusiness.settingsHint')}</p></div><button type="button" className="btn btn-sm" onClick={() => { setBusinessForm(channel.business || { enabled: false, website: '', address: '', hours: '' }); setBusinessEdit(v => !v); setSettingError('') }}>{businessEdit ? t('common.cancel') : t('channelBusiness.edit')}</button></div>
            {businessEdit && <form onSubmit={async e => { e.preventDefault(); setSettingBusy(true); setSettingError('');
              try { if (businessForm.website && !/^https?:\/\//i.test(businessForm.website.trim())) throw new Error('CHANNEL_BUSINESS_URL'); const result = await api.setChannelBusiness(id, businessForm); setChannel(result); setBusinessEdit(false) }
              catch { setSettingError(t('channelBusiness.saveError')) } finally { setSettingBusy(false) }
            }}>
              <label className="check-row"><input type="checkbox" checked={businessForm.enabled} onChange={e => setBusinessForm(v => ({...v, enabled: e.target.checked}))} />{t('channelBusiness.enable')}</label>
              {businessForm.enabled && <><label className="field"><span>{t('channelBusiness.website')}</span><input className="input" type="url" maxLength={500} placeholder="https://example.com" value={businessForm.website} onChange={e => setBusinessForm(v => ({...v, website:e.target.value}))} /></label><label className="field"><span>{t('channelBusiness.address')}</span><input className="input" maxLength={180} value={businessForm.address} onChange={e => setBusinessForm(v => ({...v, address:e.target.value}))} /></label><label className="field"><span>{t('channelBusiness.hours')}</span><input className="input" maxLength={180} value={businessForm.hours} onChange={e => setBusinessForm(v => ({...v, hours:e.target.value}))} /></label></>}
              <ErrorBox error={settingError} /><button type="submit" className="btn btn-primary" disabled={settingBusy}>{t('channelBusiness.save')}</button>
            </form>}
          </div>}
          {isOwner && api.mode === 'server' && <div className="channel-comments-setting">
            <div><strong>{t('channelComments.setting')}</strong><p>{t('channelComments.settingHint')}</p></div>
            <label className="check-row"><input type="checkbox" checked={Boolean(channel.comments_enabled)} disabled={settingBusy} onChange={async e => {
              setSettingBusy(true); setSettingError('')
              try { await api.setChannelComments(id, e.target.checked); await load() }
              catch (error) { setSettingError(errText(error, t)) }
              finally { setSettingBusy(false) }
            }} />{t('channelComments.enableToggle')} · {channel.comments_enabled ? t('channelComments.enabled') : t('channelComments.disabled')}</label>
            <ErrorBox error={settingError} />
          </div>}
          {(isOwner || me?.role === 'admin') && (
            <>
              <div className="section-label">{t('channels.publishing')}</div>
              <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>{t('channels.publishingNote')}</p>
              <div className="list">
                {members.filter((m) => m.profile.id !== channel.owner_id).map(({ profile: p, role, can_post }) => (
                  <div key={p.id} className="row-card glass" style={{ cursor: 'default' }}>
                    <Avatar profile={p} size={38} />
                    <span className="row-main">
                      <span className="row-title">{p.display_name}</span>
                      <span className="row-preview">@{p.username} · {t(role === 'owner' ? 'roles.owner' : role === 'admin' ? 'roles.admin' : 'roles.member')}{can_post ? ` · ${t('channels.canPostSuffix')}` : ''}</span>
                    </span>
                    <button className={`btn btn-sm ${can_post ? '' : 'btn-primary'}`}
                      onClick={async () => { try { await api.setChannelPoster(id, p.id, !can_post); await load() } catch (e) { setError(errText(e, t)) } }}>
                      {can_post ? t('channels.revokePosting') : t('channels.allowPosting')}
                    </button>
                  </div>
                ))}
                {members.length <= 1 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('channels.noSubscribers')}</p>}
              </div>
            </>
          )}
          {!isOwner && subscribed && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={async () => { await toggleSubscribe(); setShowInfo(false) }}>
              {t('channels.unsubscribe')}
            </button>
          )}
        </Modal>
      )}
    </div>
  )
}
