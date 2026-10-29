import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Profile } from '../lib/types'
import * as api from '../lib/api'
import { useI18n, type TranslationKey } from '../i18n'
import { IconClose, IconSearch, IconFile } from './icons'
import { AudioBubble, VideoCircle } from './MessageExtras'
import { FoxSticker } from './FoxStickers'
import { giftArt, REGULAR_GRADIENT } from '../lib/giftCatalog'
import { IconGem, IconGift, IconHeart, IconStar } from './icons'

export function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'N'
}

export function Avatar({ profile, size = 46, showOnline = false }: { profile: Pick<Profile, 'display_name' | 'avatar_url' | 'is_online'>; size?: number; showOnline?: boolean }) {
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      {profile.avatar_url ? (
        <img className="avatar" src={profile.avatar_url} alt="" style={{ width: size, height: size, fontSize: size * 0.34 }} />
      ) : (
        <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>{initials(profile.display_name)}</span>
      )}
      {showOnline && profile.is_online && <span className="online-dot" />}
    </span>
  )
}

export function GroupAvatar({ name, url, size = 46 }: { name: string; url?: string; size?: number }) {
  if (url) return <img className="avatar" src={url} alt="" style={{ width: size, height: size, borderRadius: 15 }} />
  return <span className="avatar" style={{ width: size, height: size, borderRadius: 15, fontSize: size * 0.34 }}>{initials(name)}</span>
}

export function fmtTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso); const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
export function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
export function fmtLastSeen(p: Profile, labels?: { online: string; lastSeen: string }, locale?: string) {
  if (p.is_online) return labels?.online ?? 'online'
  return `${labels?.lastSeen ?? 'last seen'} ${new Date(p.last_seen).toLocaleString(locale || undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><IconClose size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ERROR_KEYS: Record<string, TranslationKey> = {
  'That @username is already taken.': 'error.usernameTaken',
  'Invalid email or password.': 'error.invalidCredentials',
  'Username: 3–24 chars, lowercase letters, digits, _ or .': 'error.usernameInvalid',
  'Password must be at least 6 characters.': 'error.passwordShort',
  'An account with this email already exists.': 'error.emailExists',
  'Message is empty.': 'error.emptyMessage',
  'Group name is required.': 'error.groupNameRequired',
  'Channel name is required.': 'error.channelNameRequired',
  'You cannot message yourself.': 'error.cannotMessageSelf',
  'Profile not found.': 'error.profileNotFound',
  'Not enough NEX.': 'error.notEnoughNex',
  'This gift is not for sale.': 'error.giftNotForSale',
  'This gift is already yours.': 'error.giftAlreadyYours',
  'You do not own this gift.': 'error.giftNotOwned',
  'This gift is already listed.': 'error.giftAlreadyListed',
  'Price must be a positive whole number.': 'error.giftPriceInvalid',
  'No gifts left to send.': 'error.giftNoneLeft',
  'Gift not found.': 'error.giftNotFound',
  'Listing not found.': 'error.listingNotFound',
  'Daily bonus is not ready yet.': 'error.bonusNotReady',
  'Access denied.': 'error.accessDenied',
  'Invalid code.': 'error.promoInvalid',
  'Message not found.': 'error.messageNotFound',
  'This code has already been used.': 'error.promoUsed',
}

/** Map known backend/API error messages to localized UI strings. */
export function errText(e: unknown, t: (k: TranslationKey) => string): string {
  const msg = e instanceof Error ? e.message : ''
  if (!msg) return t('error.generic')
  const key = ERROR_KEYS[msg]
  return key ? t(key) : msg
}

export function ErrorBox({ error }: { error: string }) {
  if (!error) return null
  return <div className="error-box" role="alert">{error}</div>
}

export function EmptyState({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty-state glass card">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  )
}

/** Search + pick registered users (used for new chats, group members, channel posters). */
export function UserPicker({ meId, selected, onToggle, exclude = [] }: {
  meId: string
  selected: Profile[]
  onToggle: (p: Profile) => void
  exclude?: string[]
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<number>()
  const { t } = useI18n()

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    timer.current = window.setTimeout(async () => {
      try {
        const r = await api.searchUsers(q, meId)
        setResults(r.filter((p) => !exclude.includes(p.id)))
        setError('')
      } catch (e) {
        setError(errText(e, t))
      } finally { setLoading(false) }
    }, 280)
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {selected.map((p) => (
            <span key={p.id} className="member-chip glass">@{p.username}
              <button onClick={() => onToggle(p)} aria-label={`Remove ${p.username}`}><IconClose size={13} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="search-input-wrap" style={{ marginBottom: 8 }}>
        <span className="search-icon"><IconSearch size={16} /></span>
        <input className="input" placeholder={t('picker.placeholder')} value={q}
          onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <ErrorBox error={error} />
      {loading && <div className="center-loader"><div className="spinner" />{t('picker.searching')}</div>}
      {!loading && q.trim() && results.length === 0 && !error && (
        <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '14px 0' }}>{t('picker.noPeople')}: “{q}”</p>
      )}
      <div className="list">
        {results.map((p) => {
          const active = selected.some((s) => s.id === p.id)
          return (
            <button key={p.id} className="row-card glass" onClick={() => onToggle(p)}>
              <Avatar profile={p} size={42} showOnline />
              <span className="row-main">
                <span className="row-title">{p.display_name}</span>
                <span className="row-preview">@{p.username}{p.bio ? ` · ${p.bio}` : ''}</span>
              </span>
              <span className={active ? 'pill pill-accent' : 'pill'}>{active ? t('common.added') : t('common.add')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function isImageType(t: string) { return t.startsWith('image/') }

export function AttachmentView({ url, name, type, duration }: { url: string; name: string; type: string; duration?: number }) {
  if (!url) return null
  if (type === 'gift/nexo') {
    const art = giftArt(url)
    const FallbackIcon = url === 'heart-charm' ? IconHeart : url === 'lucky-star' ? IconStar : url === 'nex-gem' ? IconGem : IconGift
    return (
      <div className="gift-msg">
        {art ? <img src={art} alt="" /> : (
          <span className="gift-art-fallback" style={{ background: REGULAR_GRADIENT[url] || REGULAR_GRADIENT['nex-gem'] }}>
            <FallbackIcon size={54} />
          </span>
        )}
        <span className="gift-msg-label"><IconGift size={13} /> {name || 'Gift'}</span>
      </div>
    )
  }
  if (type === 'sticker/nexo-fox') {
    return <div className="sticker-msg"><FoxSticker variant={url} size={132} /></div>
  }
  if (type.startsWith('audio/')) {
    return <AudioBubble url={url} duration={duration} label={name || 'voice message'} />
  }
  if (type.startsWith('video/')) {
    return <VideoCircle url={url} duration={duration} label={name || 'video message'} />
  }
  if (isImageType(type)) {
    return <a href={url} target="_blank" rel="noreferrer"><img className="attachment-img" src={url} alt={name || 'attachment'} /></a>
  }
  return (
    <a className="attachment-file" href={url} target="_blank" rel="noreferrer" download={name}>
      <span style={{ display: 'inline-flex', flexShrink: 0 }}><IconFile size={16} /></span><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'File'}</span>
    </a>
  )
}
