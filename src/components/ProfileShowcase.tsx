import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import type { AttachmentInfo, GiftModel, OwnedGift, Profile, ProfilePost, UserGifts } from '../lib/types'
import { useI18n } from '../i18n'
import { AttachmentView, ErrorBox, Modal, UserPicker, errText } from './ui'
import { IconFile, IconGem, IconGift, IconHeart, IconImage, IconPlus, IconStar, IconTrash, NexCoin } from './icons'
import { GIFT_VIDEO, REGULAR_GRADIENT, fmtNex, fmtSerial, giftArt } from '../lib/giftCatalog'
import { GIFT_SELL_FEE, GIFT_TRANSFER_FEE } from '../lib/giftData'
import { useAuth } from '../lib/AuthContext'
import { isPremiumActive } from '../lib/premiumData'

type Tab = 'posts' | 'gifts'

type GiftSelection =
  | { kind: 'nft'; gift: OwnedGift }
  | { kind: 'regular'; model: GiftModel; qty: number }

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
export default function ProfileShowcase({ userId, isOwn, owner }: { userId: string; isOwn: boolean; owner?: Profile }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<ProfilePost[] | null>(null)
  const [gifts, setGifts] = useState<UserGifts | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ProfilePost | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftSelection | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState('')
  const reqRef = useRef(0)
  const toastTimer = useRef<number>()

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

  const loadGifts = useCallback(async () => {
    setError('')
    try {
      setGifts(await api.listUserGifts(userId))
    } catch (e) {
      setError(errText(e, t))
      setGifts({ items: [], regular: [] })
    }
  }, [userId, t])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  const handleGiftChanged = useCallback((message: string) => {
    setSelectedGift(null)
    void loadGifts()
    showToast(message)
  }, [loadGifts, showToast])

  useEffect(() => {
    if (tab === 'gifts') {
      void loadGifts()
      return
    }
    setPosts(null)
    void loadPosts()
  }, [tab, userId, loadPosts, loadGifts])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

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
                <button type="button" key={g.item.id} className="showcase-gift glass" onClick={() => setSelectedGift({ kind: 'nft', gift: g })}>
                  <div className="showcase-gift-art">
                    {giftArt(g.model.key)
                      ? <img src={giftArt(g.model.key)} alt={g.model.name} loading="lazy" />
                      : <div className="showcase-gift-fallback"><IconGift size={30} /></div>}
                    <span className="gift-ribbon">#{g.item.serial}</span>
                  </div>
                  <div className="showcase-gift-name">{g.model.name}</div>
                  <div className="showcase-gift-sub">{g.model.collection}</div>
                </button>
              ))}
              {gifts!.regular.map((g) => {
                const FallbackIcon = g.model.key === 'heart-charm' ? IconHeart : g.model.key === 'lucky-star' ? IconStar : IconGem
                return (
                <button type="button" key={g.model.key} className="showcase-gift glass" onClick={() => setSelectedGift({ kind: 'regular', model: g.model, qty: g.qty })}>
                  <div className="showcase-gift-art">
                    {giftArt(g.model.key)
                      ? <img src={giftArt(g.model.key)} alt={g.model.name} loading="lazy" />
                      : <div className="showcase-gift-fallback" style={{ background: REGULAR_GRADIENT[g.model.key] || REGULAR_GRADIENT['nex-gem'] }}><FallbackIcon size={30} /></div>}
                  </div>
                  <div className="showcase-gift-name">{g.model.name}</div>
                  <div className="showcase-gift-sub">×{g.qty}</div>
                </button>
                )
              })}
            </div>
          )}
          {isOwn && gifts !== null && (
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/gifts')}>
              <IconGift size={16} /> {t('posts.sendGifts')}
            </button>
          )}
        </>
      )}

      {selectedGift && (
        <ProfileGiftDetail selection={selectedGift} owner={owner} isOwn={isOwn} meId={userId}
          onClose={() => setSelectedGift(null)} onChanged={handleGiftChanged} />
      )}

      {toast && <div className="msg-toast" role="status">{toast}</div>}

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


function ProfileGiftDetail({ selection, owner, isOwn, meId, onClose, onChanged }: {
  selection: GiftSelection
  owner?: Profile
  isOwn: boolean
  meId: string
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { profile: meProfile, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sellArmed, setSellArmed] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [picked, setPicked] = useState<Profile[]>([])

  const model = selection.kind === 'nft' ? selection.gift.model : selection.model
  const item = selection.kind === 'nft' ? selection.gift.item : null
  const listing = selection.kind === 'nft' ? selection.gift.listing : null
  const art = giftArt(model.key)
  const FallbackIcon = model.key === 'heart-charm' ? IconHeart : model.key === 'lucky-star' ? IconStar : IconGem
  const sellAmount = Math.max(0, model.floor_price - GIFT_SELL_FEE)

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: t('gifts.owner'),
      value: isOwn ? t('common.you') : owner ? <>{owner.display_name} <span style={{ color: 'var(--text-3)' }}>@{owner.username}</span></> : '—',
    },
    {
      label: selection.kind === 'nft' ? t(model.key === 'nexo-vampire-kiss' ? 'gifts.storePrice' : 'gifts.value') : t('gifts.price'),
      value: <span className="nex-amount"><NexCoin size={15} /><span>{fmtNex(model.floor_price)}</span><span className="nex-balance-label">NEX</span></span>,
    },
  ]
  if (selection.kind === 'regular') {
    rows.push({ label: t('gifts.quantity'), value: `×${selection.qty}` })
  } else {
    rows.push({ label: t('gifts.collection'), value: model.collection })
    rows.push({
      label: t('gifts.model'),
      value: <>{model.name} {model.rarity_model > 0 && <span className="pill pill-violet">{model.rarity_model}%</span>}</>,
    })
    if (model.pattern) rows.push({
      label: t('gifts.pattern'),
      value: <>{model.pattern} {model.rarity_pattern > 0 && <span className="pill pill-violet">{model.rarity_pattern}%</span>}</>,
    })
    if (model.background) rows.push({
      label: t('gifts.background'),
      value: <>{model.background} {model.rarity_background > 0 && <span className="pill pill-violet">{model.rarity_background}%</span>}</>,
    })
    if (model.total_supply > 0) rows.push({
      label: t('gifts.supply'),
      value: `${fmtNex(model.issued ?? 0)}/${fmtNex(model.total_supply)} ${t('gifts.issued')}`,
    })
    if (listing) rows.push({
      label: t('gifts.price'),
      value: <span className="nex-amount"><NexCoin size={15} /><span>{fmtNex(listing.price)}</span><span className="nex-balance-label">NEX</span></span>,
    })
  }

  const sell = async () => {
    if (selection.kind !== 'regular') return
    if (!sellArmed) { setSellArmed(true); return }
    setBusy(true)
    setError('')
    try {
      const result = await api.sellRegularGift(selection.model.key)
      onChanged(t('gifts.soldBack', { amount: fmtNex(result.credit) }))
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  const transfer = async () => {
    if (selection.kind !== 'nft' || !picked[0]) return
    setBusy(true)
    setError('')
    try {
      await api.transferGift(selection.gift.item.id, picked[0].id)
      onChanged(t('gifts.transferred'))
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  return (
    <Modal title={item ? `${model.name} ${fmtSerial(item.serial)}` : model.name} onClose={onClose}>
      <div className="gift-detail-art">
        {selection.kind === 'nft' && GIFT_VIDEO[model.key] ? (
          <video key={item?.id} src={GIFT_VIDEO[model.key]} poster={art} autoPlay loop muted playsInline aria-label={model.name} />
        ) : art ? (
          <img src={art} alt={model.name} />
        ) : (
          <span className="gift-art-fallback" style={{ background: REGULAR_GRADIENT[model.key] || REGULAR_GRADIENT['nex-gem'] }}>
            <FallbackIcon size={100} />
          </span>
        )}
        {item && <span className="gift-ribbon">#{item.serial}</span>}
      </div>
      <div className="gift-detail-name">{model.name} {item && <span>{fmtSerial(item.serial)}</span>}</div>
      <div className="gift-detail-collection">{selection.kind === 'nft' ? model.collection : t('gifts.tabRegular')}</div>

      <div className="kv-list">
        {rows.map((row) => (
          <div key={row.label} className="kv-row"><span>{row.label}</span><strong>{row.value}</strong></div>
        ))}
      </div>

      <ErrorBox error={error} />

      {isOwn && selection.kind === 'regular' && (
        <div style={{ marginTop: 14 }}>
          <button className={`btn btn-block ${sellArmed ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={() => void sell()}>
            {busy ? t('common.loading') : t('gifts.sellBack', { amount: fmtNex(sellAmount) })}
          </button>
          <p className="gift-note">{t('gifts.sellBackNote')}</p>
        </div>
      )}

      {isOwn && selection.kind === 'nft' && (() => {
        const worn = Boolean(item && meProfile?.worn_gift?.item_id === item.id)
        const premium = isPremiumActive(meProfile)
        const wear = async () => {
          if (!item) return
          if (!premium) { navigate('/premium'); return }
          setBusy(true); setError('')
          try {
            await api.updatePremiumDecor({ wornItemId: worn ? null : item.id })
            await refresh()
            onChanged(t(worn ? 'premium.removedWear' : 'premium.wearing'))
          } catch (e) { setError(errText(e, t)); setBusy(false) }
        }
        return (
          <button className={`btn btn-block ${worn ? '' : 'btn-primary'}`} style={{ marginTop: 14 }} disabled={busy} onClick={() => void wear()}>
            {busy ? t('common.loading') : worn ? t('premium.removeWear') : premium ? t('premium.wear') : t('premium.wearPremium')}
          </button>
        )
      })()}

      {isOwn && selection.kind === 'nft' && (
        <div style={{ marginTop: 14 }}>
          {!transferOpen ? (
            <button className="btn btn-primary btn-block" onClick={() => setTransferOpen(true)}>
              {t('gifts.transfer')}
            </button>
          ) : (
            <>
              <p className="gift-note" style={{ marginTop: 0 }}>{t('gifts.transferFee')}</p>
              <UserPicker meId={meId} selected={picked}
                onToggle={(p) => setPicked((prev) => (prev.some((x) => x.id === p.id) ? [] : [p]))} />
              <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !picked[0]} onClick={() => void transfer()}>
                {busy ? t('common.loading') : `${t('gifts.transfer')} · ${fmtNex(GIFT_TRANSFER_FEE)} NEX`}
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
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
