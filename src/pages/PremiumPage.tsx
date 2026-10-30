import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'
import type { BusinessInfo, OwnedGift } from '../lib/types'
import { useI18n } from '../i18n'
import { BusinessBadge, ErrorBox, ProfileName, errText } from '../components/ui'
import { IconBack, IconClock, IconGem, IconGift, IconPalette, IconShield, IconStar, NexoMark } from '../components/icons'
import { giftArt, fmtSerial } from '../lib/giftCatalog'
import {
  EMOJI_STATUSES, NAME_COLORS, PREMIUM_DAYS, PREMIUM_PRICE_RUB,
  emptyBusiness, isPremiumActive, sanitizeBusiness,
} from '../lib/premiumData'

export default function PremiumPage() {
  const { profile, refresh } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [myItems, setMyItems] = useState<OwnedGift[]>([])

  const [emojiStatus, setEmojiStatus] = useState('')
  const [nameColor, setNameColor] = useState('')
  const [bgSelected, setBgSelected] = useState<string[]>([])
  const [musicTitle, setMusicTitle] = useState('')
  const [musicArtist, setMusicArtist] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [musicBusy, setMusicBusy] = useState(false)
  const musicFileRef = useRef<HTMLInputElement>(null)
  const [business, setBusiness] = useState<BusinessInfo>(emptyBusiness())
  const [saving, setSaving] = useState('')

  const active = isPremiumActive(profile)
  const untilLabel = profile?.premium_until
    ? new Date(profile.premium_until).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  useEffect(() => {
    if (!profile) return
    setEmojiStatus(profile.emoji_status || '')
    setNameColor(profile.name_color || '')
    setBgSelected((profile.bg_gifts || []).map((g) => g.item_id))
    setMusicTitle(profile.profile_music?.title || '')
    setMusicArtist(profile.profile_music?.artist || '')
    setMusicUrl(profile.profile_music?.url || '')
    setBusiness(profile.business ? sanitizeBusiness(profile.business) : emptyBusiness())
    api.getGiftState().then((st) => setMyItems(st.myItems)).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.premium_until])

  const features = useMemo(() => [
    { icon: <NexoMark size={22} />, title: t('premium.f.badge'), text: t('premium.f.badgeText') },
    { icon: <IconStar size={20} />, title: t('premium.f.status'), text: t('premium.f.statusText') },
    { icon: <IconGem size={20} />, title: t('premium.f.wear'), text: t('premium.f.wearText') },
    { icon: <span className="premium-feat-emoji">🔥</span>, title: t('premium.f.emoji'), text: t('premium.f.emojiText') },
    { icon: <span className="premium-feat-emoji">💎</span>, title: t('premium.f.reactions'), text: t('premium.f.reactionsText') },
    { icon: <IconPalette size={20} />, title: t('premium.f.colors'), text: t('premium.f.colorsText') },
    { icon: <IconClock size={20} />, title: t('premium.f.business'), text: t('premium.f.businessText') },
    { icon: <IconShield size={20} />, title: t('premium.f.noads'), text: t('premium.f.noadsText') },
  ], [t])

  if (!profile) {
    return <div className="page"><div className="center-loader"><div className="spinner" />{t('common.loading')}</div></div>
  }

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(''), 2600) }

  const redeem = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const r = await api.redeemPremiumCode(code)
      setCode('')
      await refresh()
      flash(t('premium.activated', { date: new Date(r.until).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }))
    } catch (e) { setError(errText(e, t)) } finally { setBusy(false) }
  }

  const saveDecor = async (key: string, patch: Parameters<typeof api.updatePremiumDecor>[0]) => {
    setSaving(key); setError('')
    try {
      await api.updatePremiumDecor(patch)
      await refresh()
      flash(t('premium.saved'))
    } catch (e) { setError(errText(e, t)) } finally { setSaving('') }
  }

  const dayName = (day: number) => {
    // 2024-01-01 was a Monday.
    return new Date(2024, 0, 1 + day).toLocaleDateString(locale, { weekday: 'short' })
  }

  const locked = !active && (
    <div className="premium-locked">
      <IconShield size={16} /> {t('premium.locked')}
    </div>
  )

  return (
    <div className="page premium-page">
      <div className="page-head">
        <button className="icon-btn" onClick={() => navigate('/profile')} aria-label={t('common.back')}><IconBack size={19} /></button>
        <div>
          <h1 className="page-title">{t('premium.title')}</h1>
          <p className="page-sub">{t('premium.sub')}</p>
        </div>
      </div>

      <div className="premium-hero glass card">
        <div className="logo-badge premium-logo"><NexoMark size={34} /></div>
        <h2>{t('premium.title')}</h2>
        <div className="premium-price">{t('premium.price', { price: String(PREMIUM_PRICE_RUB) })}</div>
        <p className="premium-hero-text">{t('premium.heroText')}</p>
        {active ? (
          <span className="pill pill-accent">✓ {t('premium.activeUntil', { date: untilLabel })}</span>
        ) : (
          <span className="pill">{t('premium.notActive')}</span>
        )}
        <div className="premium-myname">
          <ProfileName profile={profile} />
          <span className="row-preview">@{profile.username}</span>
        </div>
      </div>

      <ErrorBox error={error} />
      {notice && <div className="notice-box" role="status">{notice}</div>}

      <div className="settings-group glass card premium-buy">
        <div className="sw-title premium-section-title"><IconGift size={18} /> {t('premium.codeTitle')}</div>
        <div className="premium-code-row">
          <input className="input" style={{ flex: 1, textTransform: 'uppercase' }} placeholder={t('premium.codePlaceholder')}
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim() && !busy) void redeem() }}
            autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          <button className="btn btn-primary" disabled={busy || !code.trim()} onClick={() => void redeem()}>
            {busy ? t('common.loading') : t('premium.activate')}
          </button>
        </div>
        <div className="premium-buy-card">
          <div className="sw-title">{t('premium.buyTitle')}</div>
          <p>{t('premium.buyText', { price: String(PREMIUM_PRICE_RUB), days: String(PREMIUM_DAYS) })}</p>
        </div>
      </div>

      <div className="settings-group glass card">
        <div className="premium-features">
          {features.map((f) => (
            <div key={f.title} className="premium-feature">
              <span className="premium-feature-icon">{f.icon}</span>
              <span>
                <span className="premium-feature-title">{f.title}</span>
                <span className="premium-feature-text">{f.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconStar size={18} /> {t('premium.statusTitle')}</div>
        <p className="premium-hint">{t('premium.statusHint')}</p>
        {locked}
        <div className="premium-emoji-grid">
          <button className={`premium-emoji-cell ${emojiStatus === '' ? 'active' : ''}`} disabled={!active}
            onClick={() => setEmojiStatus('')} aria-label={t('premium.none')}>✕</button>
          {EMOJI_STATUSES.map((e) => (
            <button key={e} className={`premium-emoji-cell ${emojiStatus === e ? 'active' : ''}`} disabled={!active}
              onClick={() => setEmojiStatus(e)} aria-label={e}><span className="emoji-status">{e}</span></button>
          ))}
        </div>
        <button className="btn btn-primary btn-block" disabled={!active || saving === 'status'}
          onClick={() => void saveDecor('status', { emojiStatus: emojiStatus || null })}>
          {saving === 'status' ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconPalette size={18} /> {t('premium.colorsTitle')}</div>
        {locked}
        <div className="premium-colors">
          <button className={`premium-color ${nameColor === '' ? 'active' : ''}`} disabled={!active} onClick={() => setNameColor('')}>
            {t('premium.none')}
          </button>
          {NAME_COLORS.map((c) => (
            <button key={c.key} className={`premium-color ${nameColor === c.key ? 'active' : ''}`} disabled={!active}
              onClick={() => setNameColor(c.key)} style={{ color: c.color }}>
              <span className="premium-color-dot" style={{ background: c.color }} />{c.key}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-block" disabled={!active || saving === 'color'}
          onClick={() => void saveDecor('color', { nameColor })}>
          {saving === 'color' ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconGem size={18} /> {t('premium.wearTitle')}</div>
        <p className="premium-hint">{t('premium.wearHint')}</p>
        {locked}
        {myItems.length === 0 ? (
          <p className="premium-hint">{t('premium.noNfts')}</p>
        ) : (
          <div className="premium-wear-list">
            {myItems.map((g) => {
              const worn = profile.worn_gift?.item_id === g.item.id
              return (
                <div key={g.item.id} className="premium-wear-row">
                  {giftArt(g.model.key)
                    ? <img src={giftArt(g.model.key)} alt="" className="premium-wear-art" loading="lazy" />
                    : <span className="premium-wear-art premium-wear-fallback"><IconGem size={18} /></span>}
                  <span className="row-main">
                    <span className="row-title">{g.model.name}</span>
                    <span className="row-preview">{fmtSerial(g.item.serial)}</span>
                  </span>
                  {worn ? (
                    <button className="btn btn-sm" disabled={!active || saving === `wear-${g.item.id}`}
                      onClick={() => void saveDecor(`wear-${g.item.id}`, { wornItemId: null })}>{t('premium.remove')}</button>
                  ) : (
                    <button className="btn btn-sm btn-primary" disabled={!active || saving === `wear-${g.item.id}`}
                      onClick={() => void saveDecor(`wear-${g.item.id}`, { wornItemId: g.item.id })}>{t('premium.wear')}</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconGift size={18} /> {t('premium.bgTitle')}</div>
        <p className="premium-hint">{t('premium.bgHint')}</p>
        {locked}
        {myItems.length === 0 ? (
          <p className="premium-hint">{t('premium.noNfts')}</p>
        ) : (
          <>
            <div className="premium-bg-grid">
              {myItems.map((g) => {
                const on = bgSelected.includes(g.item.id)
                return (
                  <button key={g.item.id} type="button" disabled={!active}
                    className={`premium-bg-cell ${on ? 'active' : ''}`} aria-pressed={on}
                    onClick={() => setBgSelected((prev) => on ? prev.filter((x) => x !== g.item.id) : prev.length >= 8 ? prev : [...prev, g.item.id])}>
                    {giftArt(g.model.key)
                      ? <img src={giftArt(g.model.key)} alt="" loading="lazy" />
                      : <span className="premium-bg-fallback"><IconGem size={22} /></span>}
                    <span>{g.model.name}</span>
                    <span className="premium-bg-serial">{fmtSerial(g.item.serial)}</span>
                  </button>
                )
              })}
            </div>
            <button className="btn btn-primary btn-block" disabled={!active || saving === 'bg'}
              onClick={() => void saveDecor('bg', { bgGiftItemIds: bgSelected })}>
              {saving === 'bg' ? t('common.saving') : t('common.save')}
            </button>
          </>
        )}
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconStar size={18} /> {t('premium.musicTitle')}</div>
        <p className="premium-hint">{t('premium.musicHint')}</p>
        {locked}
        <div className="field" style={{ marginTop: 4 }}>
          <label>{t('premium.musicName')}</label>
          <input className="input" value={musicTitle} disabled={!active} maxLength={80}
            onChange={(e) => setMusicTitle(e.target.value)} placeholder={t('premium.musicNamePh')} />
        </div>
        <div className="field">
          <label>{t('premium.musicArtist')}</label>
          <input className="input" value={musicArtist} disabled={!active} maxLength={80}
            onChange={(e) => setMusicArtist(e.target.value)} />
        </div>
        <input ref={musicFileRef} type="file" hidden accept="audio/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f || !profile) return
            setMusicBusy(true); setError('')
            try {
              const att = await api.uploadFile(f, profile.id)
              setMusicUrl(att.url)
              if (!musicTitle) setMusicTitle(f.name.replace(/\.[^.]+$/, ''))
            } catch (err) { setError(errText(err, t)) } finally {
              setMusicBusy(false)
              if (musicFileRef.current) musicFileRef.current.value = ''
            }
          }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={!active || musicBusy} onClick={() => musicFileRef.current?.click()}>
            {musicBusy ? t('common.loading') : musicUrl ? t('premium.musicChange') : t('premium.musicUpload')}
          </button>
          {musicUrl && (
            <button className="btn" disabled={!active || saving === 'music'}
              onClick={() => { setMusicUrl(''); void saveDecor('music', { music: null }) }}>
              {t('premium.remove')}
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!active || !musicUrl || saving === 'music'}
            onClick={() => void saveDecor('music', { music: { title: musicTitle, artist: musicArtist, url: musicUrl } })}>
            {saving === 'music' ? t('common.saving') : t('common.save')}
          </button>
        </div>
        {musicUrl && <p className="premium-hint" style={{ marginTop: 8 }}>{musicTitle || 'NEXO track'} · {musicArtist}</p>}
      </div>

      <div className="settings-group glass card">
        <div className="sw-title premium-section-title"><IconClock size={18} /> {t('premium.bizTitle')}</div>
        <p className="premium-hint">{t('premium.bizHint')}</p>
        {locked}
        <label className="switch-row premium-switch">
          <span><span className="sw-title">{t('premium.bizEnable')}</span></span>
          <input type="checkbox" checked={business.enabled} disabled={!active}
            onChange={(e) => setBusiness({ ...business, enabled: e.target.checked })} />
        </label>
        <div className="field" style={{ marginTop: 12 }}>
          <label>{t('premium.bizName')}</label>
          <input className="input" value={business.name} disabled={!active} maxLength={60}
            onChange={(e) => setBusiness({ ...business, name: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('premium.bizAddress')}</label>
          <input className="input" value={business.address} disabled={!active} maxLength={120}
            onChange={(e) => setBusiness({ ...business, address: e.target.value })} />
        </div>
        <div className="premium-hours-head">
          <span className="sw-title">{t('premium.bizHours')}</span>
          <button className="btn btn-sm" disabled={!active} onClick={() => setBusiness({ ...emptyBusiness(), enabled: true, name: business.name, address: business.address })}>
            {t('premium.bizAdd')}
          </button>
        </div>
        <div className="premium-hours">
          {business.hours.map((h) => (
            <div key={h.day} className="premium-hour-row">
              <label className="premium-hour-day">
                <input type="checkbox" checked={h.enabled} disabled={!active}
                  onChange={(e) => setBusiness({
                    ...business,
                    hours: business.hours.map((x) => (x.day === h.day ? { ...x, enabled: e.target.checked } : x)),
                  })} />
                <span>{dayName(h.day)}</span>
              </label>
              <input type="time" className="input premium-time" value={h.open} disabled={!active || !h.enabled}
                onChange={(e) => setBusiness({
                  ...business,
                  hours: business.hours.map((x) => (x.day === h.day ? { ...x, open: e.target.value } : x)),
                })} />
              <span className="premium-hour-sep">—</span>
              <input type="time" className="input premium-time" value={h.close} disabled={!active || !h.enabled}
                onChange={(e) => setBusiness({
                  ...business,
                  hours: business.hours.map((x) => (x.day === h.day ? { ...x, close: e.target.value } : x)),
                })} />
            </div>
          ))}
        </div>
        {business.enabled && (
          <div style={{ margin: '12px 0' }}>
            <BusinessBadge profile={{ business }} />
            {business.address && <span className="row-preview" style={{ marginLeft: 8 }}>{business.address}</span>}
          </div>
        )}
        <button className="btn btn-primary btn-block" disabled={!active || saving === 'biz'}
          onClick={() => void saveDecor('biz', { business })}>
          {saving === 'biz' ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
