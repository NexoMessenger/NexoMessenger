import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import type { AttachmentInfo, ProfilePost, UserGifts } from '../lib/types'
import { useI18n } from '../i18n'
import { AttachmentView, ErrorBox, Modal, errText } from './ui'
import { IconFile, IconGift, IconImage, IconPlus, IconTrash } from './icons'
import { giftArt } from '../lib/giftCatalog'

type Tab = 'posts' | 'gifts'

function PostTile({ post, onOpen }: { post: ProfilePost; onOpen: () => void }) {
  const isImg = post.attachment_type.startsWith('image/')
  const isVid = post.attachment_type.startsWith('video/')
  return (
    <button className="post-tile" onClick={onOpen} aria-label={post.body || post.attachment_name || 'post'}>
      {post.attachment_url && isImg ? (
        <img src={post.attachment_url} alt="" loading="lazy" />
      ) : post.attachment_url && isVid ? (
        <video src={post.attachment_url} muted playsInline preload="metadata" />
      ) : post.attachment_url ? (
        <span className="post-tile-file"><IconFile size={22} /><span>{post.attachment_name}</span></span>
      ) : (
        <span className="post-tile-text">{post.body}</span>
      )}
      {isVid && <span className="post-tile-badge">▶</span>}
    </button>
  )
}

/**
 * Tabbed profile showcase: Publications / Gifts (regular gifts and
 * collectible NFTs in one flat grid — no collections). Used on the own
 * Profile page and in other users' profile cards, so everything shown
 * is real backend data everywhere — not a static mockup.
 */
export default function ProfileShowcase({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<ProfilePost[] | null>(null)
  const [gifts, setGifts] = useState<UserGifts | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ProfilePost | null>(null)
  const [creating, setCreating] = useState(false)
  const reqRef = useRef(0)

  const loadPosts = useCallback(async () => {
    const req = ++reqRef.current
    setError('')
    try {
      const list = await api.listProfilePosts(userId)
      if (reqRef.current === req) setPosts(list)
    } catch (e) {
      if (reqRef.current === req) { setError(errText(e, t)); setPosts([]) }
    }
  }, [userId, t])

  useEffect(() => {
    if (tab === 'gifts') {
      if (gifts === null) {
        api.listUserGifts(userId).then(setGifts).catch((e) => { setError(errText(e, t)); setGifts({ items: [], regular: [] }) })
      }
      return
    }
    setPosts(null)
    void loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId, loadPosts])

  const giftCount = (gifts?.items.length || 0) + (gifts?.regular.length || 0)

  return (
    <div className="showcase">
      <div className="profile-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'posts'} className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>{t('posts.publications')}</button>
        <button role="tab" aria-selected={tab === 'gifts'} className={tab === 'gifts' ? 'active' : ''} onClick={() => setTab('gifts')}>{t('posts.gifts')}</button>
      </div>

      <ErrorBox error={error} />

      {tab === 'posts' && (
        <>
          {isOwn && (
            <button className="btn btn-primary showcase-add" onClick={() => setCreating(true)}>
              <IconPlus size={16} /> {t('posts.add')}
            </button>
          )}
          {posts === null ? (
            <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
          ) : posts.length === 0 ? (
            <div className="empty-state" style={{ padding: '26px 10px' }}>
              <div className="empty-icon"><IconImage size={26} /></div>
              <h3>{t('posts.empty')}</h3>
              <p>{isOwn ? t('posts.emptyHintOwn') : t('posts.emptyHint')}</p>
            </div>
          ) : (
            <div className="posts-grid">
              {posts.map((p) => <PostTile key={p.id} post={p} onOpen={() => setSelected(p)} />)}
            </div>
          )}
        </>
      )}

      {tab === 'gifts' && (
        <>
          {gifts === null ? (
            <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
          ) : giftCount === 0 ? (
            <div className="empty-state" style={{ padding: '26px 10px' }}>
              <div className="empty-icon"><IconGift size={26} /></div>
              <h3>{t('posts.noGifts')}</h3>
            </div>
          ) : (
            <div className="showcase-gifts">
              {gifts!.items.map((g) => (
                <div key={g.item.id} className="showcase-gift glass">
                  <div className="showcase-gift-art">
                    {giftArt(g.model.key)
                      ? <img src={giftArt(g.model.key)} alt={g.model.name} loading="lazy" />
                      : <div className="showcase-gift-fallback"><IconGift size={30} /></div>}
                    <span className="gift-ribbon">#{g.item.serial}</span>
                  </div>
                  <div className="showcase-gift-name">{g.model.name}</div>
                  <div className="showcase-gift-sub">{g.model.collection}</div>
                </div>
              ))}
              {gifts!.regular.map((g) => (
                <div key={g.model.key} className="showcase-gift glass">
                  <div className="showcase-gift-art">
                    {giftArt(g.model.key)
                      ? <img src={giftArt(g.model.key)} alt={g.model.name} loading="lazy" />
                      : <div className="showcase-gift-fallback"><IconGift size={30} /></div>}
                  </div>
                  <div className="showcase-gift-name">{g.model.name}</div>
                  <div className="showcase-gift-sub">×{g.qty}</div>
                </div>
              ))}
            </div>
          )}
          {isOwn && gifts !== null && (
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/gifts')}>
              <IconGift size={16} /> {t('posts.sendGifts')}
            </button>
          )}
        </>
      )}

      {selected && (
        <PostDetail post={selected} isOwn={isOwn} locale={locale}
          onClose={() => setSelected(null)}
          onDeleted={() => { setPosts((prev) => (prev ? prev.filter((p) => p.id !== selected.id) : prev)); setSelected(null) }} />
      )}

      {creating && (
        <CreatePost userId={userId} onClose={() => setCreating(false)}
          onDone={(post) => { setCreating(false); setTab('posts'); setPosts((prev) => [post, ...(prev || [])]) }} />
      )}
    </div>
  )
}

function PostDetail({ post, isOwn, locale, onClose, onDeleted }: {
  post: ProfilePost
  isOwn: boolean
  locale: string
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState('')

  const del = async () => {
    if (!armed) { setArmed(true); return }
    setBusy(true); setError('')
    try { await api.deletePost(post.id, post.user_id); onDeleted() }
    catch (e) { setError(errText(e, t)); setBusy(false) }
  }

  return (
    <Modal title={new Date(post.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} onClose={onClose}>
      <div className="post-detail">
        <AttachmentView url={post.attachment_url} name={post.attachment_name} type={post.attachment_type} />
        {post.body && <p className="post-detail-body">{post.body}</p>}
        <ErrorBox error={error} />
        {isOwn && (
          <button className="btn btn-danger btn-block" style={{ marginTop: 12 }} disabled={busy} onClick={() => void del()}>
            <IconTrash size={15} /> {armed ? t('msg.deleteConfirm') : t('posts.delete')}
          </button>
        )}
      </div>
    </Modal>
  )
}

function CreatePost({ userId, onClose, onDone }: {
  userId: string
  onClose: () => void
  onDone: (post: ProfilePost) => void
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [att, setAtt] = useState<AttachmentInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true); setError('')
    try { setAtt(await api.uploadFile(file, userId)) }
    catch (e) { setError(errText(e, t)) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const publish = async () => {
    if (!text.trim() && !att) { setError(t('posts.needContent')); return }
    setBusy(true); setError('')
    try { onDone(await api.createPost(userId, text, att || undefined)) }
    catch (e) { setError(errText(e, t)); setBusy(false) }
  }

  return (
    <Modal title={t('posts.new')} onClose={onClose}>
      <div className="field">
        <textarea className="textarea" rows={3} maxLength={2000} placeholder={t('posts.caption')}
          value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {att && (
        <div className="post-create-preview">
          <AttachmentView url={att.url} name={att.name} type={att.type} />
          <button className="btn btn-sm" onClick={() => setAtt(null)}>{t('posts.removeMedia')}</button>
        </div>
      )}
      <input ref={fileRef} type="file" hidden accept="image/*,video/*" onChange={(e) => void pick(e.target.files?.[0])} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1 }} disabled={uploading} onClick={() => fileRef.current?.click()}>
          <IconImage size={16} /> {uploading ? t('composer.uploading') : att ? t('posts.changeMedia') : t('posts.media')}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || uploading} onClick={() => void publish()}>
          {busy ? t('common.loading') : t('posts.publish')}
        </button>
      </div>
      <div style={{ marginTop: 10 }}><ErrorBox error={error} /></div>
    </Modal>
  )
}
