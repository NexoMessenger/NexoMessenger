import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useI18n, type TranslationKey } from '../i18n'
import * as api from '../lib/api'
import type { GiftItem, GiftListing, GiftModel, GiftState, MarketEntry, OwnedGift, Profile } from '../lib/types'
import { giftArt, GIFT_VIDEO, fmtNex, fmtSerial, REGULAR_GRADIENT } from '../lib/giftCatalog'
import { GIFT_COLLECTIONS, COLLECTIBLE_MODELS, REGULAR_MODELS } from '../lib/giftData'
import { Avatar, EmptyState, ErrorBox, Modal, UserPicker, errText } from '../components/ui'
import {
  IconBack, IconFilter, IconGem, IconGift, IconHeart, IconPlus, IconSearch, IconStar, NexCoin,
} from '../components/icons'

interface Selection {
  item: GiftItem
  model: GiftModel
  listing: GiftListing | null
  seller: Profile | null
  price: number | null
}

function GiftArtView({ modelKey, iconSize = 64 }: { modelKey: string; iconSize?: number }) {
  const art = giftArt(modelKey)
  if (art) return <img src={art} alt="" loading="lazy" />
  const FallbackIcon = modelKey === 'heart-charm' ? IconHeart : modelKey === 'lucky-star' ? IconStar : IconGem
  return (
    <span className="gift-art-fallback" style={{ background: REGULAR_GRADIENT[modelKey] || REGULAR_GRADIENT['nex-gem'] }}>
      <FallbackIcon size={iconSize} />
    </span>
  )
}

function NexAmount({ amount, size = 16 }: { amount: number; size?: number }) {
  return (
    <span className="nex-amount">
      <NexCoin size={size} />
      <span>{fmtNex(amount)}</span>
    </span>
  )
}

function fmtCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return ''
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  return `${h} h ${mins % 60} min`
}

export default function GiftsPage() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [view, setView] = useState<'mine' | 'market'>('mine')
  const [tab, setTab] = useState<'regular' | 'collectibles'>('regular')
  const [state, setState] = useState<GiftState | null>(null)
  const [market, setMarket] = useState<MarketEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [listTarget, setListTarget] = useState<OwnedGift | null>(null)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<GiftModel | null>(null)

  // market filters
  const [q, setQ] = useState('')
  const [collection, setCollection] = useState('')
  const [modelKey, setModelKey] = useState('')
  const [sort, setSort] = useState('featured')
  const [source, setSource] = useState<'all' | 'store' | 'users'>('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [st, mk] = await Promise.all([api.getGiftState(), api.getGiftMarket()])
      setState(st)
      setMarket(mk)
      setError('')
    } catch (e) {
      if (!silent) setError(errText(e, t))
    } finally {
      if (!silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => api.subscribeGlobal(() => { load(true) }), [load])

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 4200)
  }

  const filteredMarket = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    let out = market.filter((e) => {
      if (collection && e.model.collection !== collection) return false
      if (modelKey && e.model.key !== modelKey) return false
      if (source === 'store' && e.listing) return false
      if (source === 'users' && !e.listing) return false
      if (maxPrice && Number(maxPrice) > 0 && e.price > Number(maxPrice)) return false
      if (needle && !e.model.name.toLowerCase().includes(needle) && !String(e.item.serial).includes(needle)) return false
      return true
    })
    if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price)
    else if (sort === 'rarity') out = [...out].sort((a, b) => a.model.rarity_model - b.model.rarity_model)
    return out
  }, [market, q, collection, modelKey, sort, source, maxPrice])

  const hasFilters = Boolean(q || collection || modelKey || source !== 'all' || maxPrice)
  const clearFilters = () => { setQ(''); setCollection(''); setModelKey(''); setSource('all'); setMaxPrice('') }

  const doBuy = async (sel: Selection) => {
    setBusy('buy')
    try {
      await api.buyGift(sel.item.id)
      setSelected(null)
      await load(true)
      setView('mine')
      setTab('collectibles')
      flash(t('gifts.bought'))
    } catch (e) {
      throw e
    } finally { setBusy('') }
  }

  const doUnlist = async (sel: Selection) => {
    if (!sel.listing) return
    setBusy('unlist')
    try {
      await api.unlistGift(sel.listing.id)
      setSelected(null)
      await load(true)
      flash(t('gifts.unlisted'))
    } finally { setBusy('') }
  }

  const doBuyRegular = async (model: GiftModel) => {
    setBusy(`regular-${model.key}`)
    try {
      await api.buyRegularGift(model.key)
      await load(true)
      flash(t('gifts.bought'))
    } catch (e) {
      setError(errText(e, t))
    } finally { setBusy('') }
  }

  if (!profile) return null

  const balanceChip = (
    <div className="nex-balance glass">
      <NexAmount amount={state?.balance ?? 0} size={22} />
      <span className="nex-balance-label">NEX</span>
      <button className="nex-plus" onClick={() => setTopUpOpen(true)} aria-label={t('gifts.getNex')}>
        <IconPlus size={15} />
      </button>
    </div>
  )

  return (
    <div className="page">
      {view === 'mine' ? (
        <>
          <div className="page-head">
            <div>
              <h1 className="page-title">{t('gifts.title')}</h1>
              <p className="page-sub">{t('gifts.subtitle')}</p>
            </div>
            {balanceChip}
          </div>

          <div className="seg gift-tabs" role="tablist">
            <button className={tab === 'regular' ? 'active' : ''} onClick={() => setTab('regular')}>{t('gifts.tabRegular')}</button>
            <button className={tab === 'collectibles' ? 'active' : ''} onClick={() => setTab('collectibles')}>{t('gifts.tabCollectibles')}</button>
          </div>

          {notice && <div className="notice-box" role="status">{notice}</div>}
          <ErrorBox error={error} />
          {loading && !state ? (
            <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
          ) : tab === 'regular' ? (
            <>
              <div className="gift-grid">
                {REGULAR_MODELS.map((model) => {
                  const owned = state?.myRegular.find((r) => r.model.key === model.key)?.qty ?? 0
                  return (
                    <article key={model.key} className="gift-card glass">
                      <div className="gift-art"><GiftArtView modelKey={model.key} iconSize={58} /></div>
                      <div className="gift-card-body">
                        <div className="gift-card-name">{model.name}</div>
                        <div className="gift-card-sub">
                          {owned > 0 ? <span className="pill pill-violet">{t('gifts.owned')} ×{owned}</span> : <span>&nbsp;</span>}
                        </div>
                        <div className="gift-card-actions">
                          <button className="btn btn-primary btn-sm gift-buy-btn" disabled={busy === `regular-${model.key}`}
                            onClick={() => doBuyRegular(model)}>
                            <NexCoin size={15} /> {fmtNex(model.floor_price)}
                          </button>
                          {owned > 0 && (
                            <button className="btn btn-sm" onClick={() => setSendTarget(model)}>{t('gifts.send')}</button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
              <p className="gift-note">{t('gifts.regularNote')}</p>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-block gift-market-cta" onClick={() => setView('market')}>
                <IconGift size={17} /> {t('gifts.goMarket')}
              </button>
              {state && state.myItems.length === 0 ? (
                <EmptyState icon={<IconGift size={36} />} title={t('gifts.emptyCollectionTitle')} text={t('gifts.emptyCollectionText')}>
                  <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('market')}>
                    {t('gifts.goMarket')}
                  </button>
                </EmptyState>
              ) : (
                <div className="gift-grid">
                  {state?.myItems.map(({ item, model, listing }) => (
                    <article key={item.id} className="gift-card glass gift-clickable"
                      onClick={() => setSelected({ item, model, listing, seller: listing ? profile : null, price: listing?.price ?? null })}>
                      <div className="gift-art">
                        <GiftArtView modelKey={model.key} />
                        <span className="gift-serial">{fmtSerial(item.serial)}</span>
                        {listing && <span className="gift-sale-pill">{t('gifts.forSale')}</span>}
                      </div>
                      <div className="gift-card-body">
                        <div className="gift-card-name">{model.name}</div>
                        <div className="gift-card-sub">{model.collection}</div>
                        <div className="gift-card-value">
                          {listing ? <NexAmount amount={listing.price} size={15} /> : <span>≈ <NexAmount amount={model.floor_price} size={15} /></span>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {state && state.transactions.length > 0 && (
                <>
                  <div className="section-label">{t('gifts.history')}</div>
                  <div className="list">
                    {state.transactions.map((tx) => (
                      <div key={tx.id} className="row-card glass gift-tx-row">
                        <span className="row-main">
                          <span className="row-title" style={{ fontSize: 14 }}>{t(`gifts.tx.${tx.kind}` as TranslationKey)}</span>
                          <span className="row-preview">{tx.note}</span>
                        </span>
                        <span className={`gift-tx-amount ${tx.amount > 0 ? 'pos' : tx.amount < 0 ? 'neg' : ''}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount !== 0 ? fmtNex(tx.amount) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="page-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="icon-btn" onClick={() => setView('mine')} aria-label={t('common.back')}><IconBack size={18} /></button>
              <div>
                <h1 className="page-title">{t('gifts.title')}</h1>
                <p className="page-sub">{t('gifts.marketSub')}</p>
              </div>
            </div>
            {balanceChip}
          </div>

          {notice && <div className="notice-box" role="status">{notice}</div>}
          <ErrorBox error={error} />

          <div className="search-input-wrap">
            <span className="search-icon"><IconSearch size={16} /></span>
            <input className="input" placeholder={t('gifts.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="gift-tools">
            <select className="select gift-tool" value={collection} onChange={(e) => setCollection(e.target.value)} aria-label={t('gifts.collections')}>
              <option value="">{t('gifts.collections')}: {t('gifts.all')}</option>
              {GIFT_COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select gift-tool" value={modelKey} onChange={(e) => setModelKey(e.target.value)} aria-label={t('gifts.models')}>
              <option value="">{t('gifts.models')}: {t('gifts.all')}</option>
              {COLLECTIBLE_MODELS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
            <button className={`btn btn-sm gift-tool ${filtersOpen ? 'btn-primary' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)}>
              <IconFilter size={15} /> {t('gifts.filters')}
            </button>
            <select className="select gift-tool" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('gifts.sort')}>
              <option value="featured">{t('gifts.sortFeatured')}</option>
              <option value="price-asc">{t('gifts.sortPriceAsc')}</option>
              <option value="price-desc">{t('gifts.sortPriceDesc')}</option>
              <option value="rarity">{t('gifts.sortRarity')}</option>
            </select>
          </div>

          {filtersOpen && (
            <div className="gift-filters glass card">
              <div className="seg" role="tablist">
                <button className={source === 'all' ? 'active' : ''} onClick={() => setSource('all')}>{t('gifts.all')}</button>
                <button className={source === 'store' ? 'active' : ''} onClick={() => setSource('store')}>{t('gifts.store')}</button>
                <button className={source === 'users' ? 'active' : ''} onClick={() => setSource('users')}>{t('gifts.fromUsers')}</button>
              </div>
              <input className="input" type="number" min={0} placeholder={t('gifts.maxPrice')}
                value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          )}

          <div className="gift-results-head">
            <span className="section-label" style={{ margin: 0 }}>{t('gifts.allItems')} · {filteredMarket.length}</span>
            {hasFilters && <button className="link-btn" onClick={clearFilters}>{t('gifts.clear')}</button>}
          </div>

          {loading && market.length === 0 ? (
            <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>
          ) : filteredMarket.length === 0 ? (
            <EmptyState icon={<IconSearch size={34} />} title={t('gifts.noResultsTitle')} text={t('gifts.noResults')} />
          ) : (
            <div className="gift-grid">
              {filteredMarket.map((entry) => (
                <article key={entry.item.id} className="gift-card glass gift-clickable"
                  onClick={() => setSelected({ item: entry.item, model: entry.model, listing: entry.listing, seller: entry.seller, price: entry.price })}>
                  <div className="gift-art">
                    <GiftArtView modelKey={entry.model.key} />
                    <span className="gift-serial">{fmtSerial(entry.item.serial)}</span>
                  </div>
                  <div className="gift-card-body">
                    <div className="gift-card-name">{entry.model.name}</div>
                    <div className="gift-card-sub">
                      {entry.listing
                        ? <>@{entry.seller?.username ?? '?'} · {entry.model.collection}</>
                        : <>{t('gifts.store')} · {entry.model.collection}</>}
                    </div>
                    <button className="btn btn-primary btn-sm gift-price-btn" tabIndex={-1}>
                      <NexCoin size={15} /> {fmtNex(entry.price)}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <GiftDetailsModal
          sel={selected}
          meId={profile.id}
          balance={state?.balance ?? 0}
          busy={busy}
          onClose={() => setSelected(null)}
          onBuy={doBuy}
          onUnlist={doUnlist}
          onListClick={() => {
            const owned = state?.myItems.find((o) => o.item.id === selected.item.id)
            if (owned) { setSelected(null); setListTarget(owned) }
          }}
          onGetNex={() => { setSelected(null); setTopUpOpen(true) }}
        />
      )}
      {listTarget && (
        <ListForSaleModal
          owned={listTarget}
          onClose={() => setListTarget(null)}
          onDone={async () => { setListTarget(null); await load(true); flash(t('gifts.listed')) }}
        />
      )}
      {topUpOpen && state && (
        <TopUpModal state={state} onClose={() => setTopUpOpen(false)}
          onClaimed={async () => { await load(true); flash(t('gifts.bonusClaimed')) }} />
      )}
      {sendTarget && (
        <SendGiftModal model={sendTarget} meId={profile.id} onClose={() => setSendTarget(null)}
          onSent={(convId) => { setSendTarget(null); navigate(`/chat/${convId}`) }} />
      )}
    </div>
  )
}

/* ============================== details sheet ============================== */

function GiftDetailsModal({ sel, meId, balance, busy, onClose, onBuy, onUnlist, onListClick, onGetNex }: {
  sel: Selection
  meId: string
  balance: number
  busy: string
  onClose: () => void
  onBuy: (sel: Selection) => Promise<void>
  onUnlist: (sel: Selection) => Promise<void>
  onListClick: () => void
  onGetNex: () => void
}) {
  const { t } = useI18n()
  const [error, setError] = useState('')
  const { item, model, listing, seller, price } = sel
  const isMine = item.owner_id === meId
  const insufficient = price !== null && !isMine && balance < price

  const buy = async () => {
    setError('')
    try { await onBuy(sel) } catch (e) { setError(errText(e, t)) }
  }

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: t('gifts.owner'),
      value: isMine
        ? t('common.you')
        : listing
          ? (seller ? <span className="gift-owner"><Avatar profile={seller} size={22} /> @{seller.username}</span> : '@?')
          : t('gifts.store'),
    },
    { label: t('gifts.collection'), value: model.collection },
    {
      label: t('gifts.model'),
      value: <>{model.name} {model.rarity_model > 0 && <span className="pill pill-violet">{model.rarity_model}%</span>}</>,
    },
  ]
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

  return (
    <Modal title={`${model.name} ${fmtSerial(item.serial)}`} onClose={onClose}>
      <div className="gift-detail-art">
        {GIFT_VIDEO[model.key] ? (
          <video key={item.id} src={GIFT_VIDEO[model.key]} poster={giftArt(model.key)}
            autoPlay loop muted playsInline aria-label={model.name} />
        ) : (
          <GiftArtView modelKey={model.key} iconSize={110} />
        )}
      </div>
      <div className="gift-detail-name">{model.name} <span>{fmtSerial(item.serial)}</span></div>
      <div className="gift-detail-collection">{model.collection}</div>

      <div className="kv-list">
        {rows.map((r) => (
          <div key={r.label} className="kv-row"><span>{r.label}</span><strong>{r.value}</strong></div>
        ))}
        <div className="kv-row">
          <span>{t('gifts.value')}</span>
          <strong><NexAmount amount={model.floor_price} size={15} /></strong>
        </div>
        {price !== null && (
          <div className="kv-row">
            <span>{t('gifts.price')}</span>
            <strong><NexAmount amount={price} size={15} /></strong>
          </div>
        )}
      </div>

      <ErrorBox error={error} />
      {insufficient && !error && (
        <div className="notice-box" role="alert">
          {t('gifts.insufficientText')} {t('gifts.yourBalance')}: {fmtNex(balance)} NEX.
        </div>
      )}

      {isMine ? (
        listing ? (
          <>
            <div className="notice-box">{t('gifts.listedFor')} <NexAmount amount={listing.price} size={15} /></div>
            <button className="btn btn-danger btn-block" disabled={busy === 'unlist'} onClick={() => onUnlist(sel)}>
              {t('gifts.removeListing')}
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-block" onClick={onListClick}>{t('gifts.listForSale')}</button>
        )
      ) : price !== null ? (
        <>
          <button className="btn btn-primary btn-block gift-buy-big" disabled={busy === 'buy'} onClick={buy}>
            {t('gifts.buy')} · <NexAmount amount={price} size={17} />
          </button>
          {insufficient && (
            <button className="btn btn-block" style={{ marginTop: 8 }} onClick={onGetNex}>{t('gifts.getNex')}</button>
          )}
        </>
      ) : (
        <div className="notice-box">{t('gifts.notForSale')}</div>
      )}
    </Modal>
  )
}

/* ============================== list for sale ============================== */

function ListForSaleModal({ owned, onClose, onDone }: {
  owned: OwnedGift
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const { t } = useI18n()
  const [priceText, setPriceText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const price = Number(priceText)
  const priceValid = Number.isInteger(price) && price > 0 && price <= 1000000000

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await api.listGift(owned.item.id, price)
      await onDone()
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('gifts.listTitle')} onClose={onClose}>
      <div className="gift-detail-art small"><GiftArtView modelKey={owned.model.key} iconSize={72} /></div>
      <div className="gift-detail-name">{owned.model.name} <span>{fmtSerial(owned.item.serial)}</span></div>
      {!confirming ? (
        <>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="gift-price">{t('gifts.priceLabel')}</label>
            <input id="gift-price" className="input" type="number" min={1} step={1} inputMode="numeric"
              placeholder={fmtNex(owned.model.floor_price)} value={priceText}
              onChange={(e) => setPriceText(e.target.value)} autoFocus />
          </div>
          {priceText && !priceValid && <div className="error-box" role="alert">{t('gifts.priceInvalid')}</div>}
          <p className="gift-note">{t('gifts.floorHint', { price: fmtNex(owned.model.floor_price) })}</p>
          <button className="btn btn-primary btn-block" disabled={!priceValid} onClick={() => setConfirming(true)}>
            {t('gifts.continue')}
          </button>
        </>
      ) : (
        <>
          <div className="kv-list">
            <div className="kv-row"><span>{t('gifts.model')}</span><strong>{owned.model.name} {fmtSerial(owned.item.serial)}</strong></div>
            <div className="kv-row"><span>{t('gifts.price')}</span><strong><NexAmount amount={price} size={15} /></strong></div>
          </div>
          <p className="gift-note">{t('gifts.listNote')}</p>
          <ErrorBox error={error} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setConfirming(false)}>{t('common.back')}</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy} onClick={submit}>
              {busy ? t('common.loading') : t('gifts.confirmList')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ============================== top up / bonus ============================== */

function TopUpModal({ state, onClose, onClaimed }: {
  state: GiftState
  onClose: () => void
  onClaimed: () => Promise<void>
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const claim = async () => {
    setBusy(true)
    setError('')
    try {
      await api.claimGiftBonus()
      await onClaimed()
      onClose()
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('gifts.getNex')} onClose={onClose}>
      <div className="gift-balance-hero">
        <NexCoin size={44} />
        <div className="gift-balance-value">{fmtNex(state.balance)} <span>NEX</span></div>
        <div className="gift-card-sub">{t('gifts.yourBalance')}</div>
      </div>
      <div className="kv-list">
        <div className="kv-row"><span>{t('gifts.bonus')}</span><strong>+{fmtNex(state.bonusAmount)} NEX</strong></div>
        <div className="kv-row">
          <span>{t('gifts.bonusStatus')}</span>
          <strong>{state.nextBonusAt ? fmtCountdown(state.nextBonusAt) : t('gifts.bonusReady')}</strong>
        </div>
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy || Boolean(state.nextBonusAt)} onClick={claim}>
        {busy ? t('common.loading') : `${t('gifts.claim')} +${fmtNex(state.bonusAmount)} NEX`}
      </button>
      <p className="gift-note">{t('gifts.welcomeNote')}</p>
      <p className="gift-note">{t('gifts.virtualNote')}</p>
    </Modal>
  )
}

/* ============================== send regular gift ============================== */

function SendGiftModal({ model, meId, onClose, onSent }: {
  model: GiftModel
  meId: string
  onClose: () => void
  onSent: (conversationId: string) => void
}) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<Profile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!picked[0]) return
    setBusy(true)
    setError('')
    try {
      const convId = await api.sendRegularGift(model.key, picked[0].id)
      onSent(convId)
    } catch (e) {
      setError(errText(e, t))
      setBusy(false)
    }
  }

  return (
    <Modal title={`${t('gifts.send')}: ${model.name}`} onClose={onClose}>
      <UserPicker meId={meId} selected={picked}
        onToggle={(p) => setPicked((prev) => (prev.some((x) => x.id === p.id) ? [] : [p]))} />
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !picked[0]} onClick={send}>
        {busy ? t('common.loading') : t('gifts.send')}
      </button>
    </Modal>
  )
}
