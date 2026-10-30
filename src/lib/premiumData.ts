import type { BusinessHoursDay, BusinessInfo, Profile } from './types'
import { normalizePromoCode } from './giftData'

/**
 * NEXO Premium — shared catalog.
 *
 * Premium costs 100 ₽ per 30 days. There is no card-payment gateway wired
 * into the app, so the honest sales channel is a one-time Premium code:
 * the buyer pays the NEXO admin 100 ₽ and receives a code that activates
 * 30 days (codes stack: activating while active adds 30 more days).
 * Every activation decision is made by the backend (server / Supabase RPC /
 * local store) — the frontend only sends the typed code. Keep PREMIUM_CODES
 * in sync with server/index.mjs and supabase/migrations/013_premium.sql.
 */
export const PREMIUM_PRICE_RUB = 100
export const PREMIUM_DAYS = 30

export const PREMIUM_CODES: { code: string; days: number }[] = [
  { code: 'NEXO-PRO-A7K9', days: 30 },
  { code: 'NEXO-PRO-M3QX', days: 30 },
  { code: 'NEXO-PRO-T8WD', days: 30 },
  { code: 'NEXO-PRO-Z4HP', days: 30 },
  { code: 'NEXO-PRO-K6SN', days: 30 },
  { code: 'NEXO-PRO-D9VC', days: 30 },
  { code: 'NEXO-PRO-R2MB', days: 30 },
  { code: 'NEXO-PRO-F5XJ', days: 30 },
  { code: 'NEXO-PRO-Q7GT', days: 30 },
  { code: 'NEXO-PRO-W4NA', days: 30 },
]

export const normalizePremiumCode = normalizePromoCode

export const isPremiumActive = (p?: Pick<Profile, 'premium_until'> | null, at = Date.now()): boolean =>
  Boolean(p?.premium_until && new Date(p.premium_until).getTime() > at)

/** Emoji that can be set as the animated status next to the nickname. */
export const EMOJI_STATUSES = [
  '🔥', '⭐', '💎', '👑', '🚀', '🎧', '🎮', '⚽', '🌙', '☀️',
  '❤️', '😎', '🥳', '😴', '💼', '📚', '✈️', '🍕', '🐱', '🦊',
]

/**
 * NEXO animated emoji pack for the composer: inserted into the text and
 * rendered with a CSS animation (transform/opacity only, reduced-motion
 * safe). `anim` is the animation flavour.
 */
export const NEXO_ANIMATED_EMOJI: { emoji: string; anim: 'bounce' | 'pulse' | 'spin' | 'float' | 'shake' }[] = [
  { emoji: '🔥', anim: 'pulse' },
  { emoji: '💎', anim: 'float' },
  { emoji: '⭐', anim: 'spin' },
  { emoji: '🚀', anim: 'float' },
  { emoji: '🎉', anim: 'bounce' },
  { emoji: '❤️', anim: 'pulse' },
  { emoji: '😂', anim: 'shake' },
  { emoji: '😮', anim: 'bounce' },
  { emoji: '👑', anim: 'float' },
  { emoji: '⚡', anim: 'pulse' },
  { emoji: '🌙', anim: 'float' },
  { emoji: '🦊', anim: 'bounce' },
]

/** Extra reactions unlocked by Premium (base set stays free for everyone). */
export const PREMIUM_REACTIONS = ['💎', '🚀', '🥳', '💯', '🙏', '👑']

/** Name colour palette keys -> CSS colour for the display name. */
export const NAME_COLORS: { key: string; color: string }[] = [
  { key: 'violet', color: '#A78BFA' },
  { key: 'sky', color: '#38BDF8' },
  { key: 'mint', color: '#34D399' },
  { key: 'gold', color: '#FBBF24' },
  { key: 'rose', color: '#FB7185' },
  { key: 'peach', color: '#FDBA74' },
]

export const nameColorOf = (key?: string): string | undefined =>
  NAME_COLORS.find((c) => c.key === key)?.color

export const emptyBusinessHours = (): BusinessHoursDay[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, enabled: day < 5, open: '09:00', close: '18:00' }))

export const emptyBusiness = (): BusinessInfo => ({ enabled: false, name: '', address: '', hours: emptyBusinessHours() })

const mins = (hhmm: string): number => {
  const [h, m] = String(hhmm || '').split(':').map((x) => Number(x))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

export interface BusinessStatus {
  open: boolean
  /** "18:00" when open (closing time) or next opening "09:00". */
  time: string
  /** Day index (0=Mon) of the next opening when closed; -1 = today. */
  nextDay: number
}

/** Open/closed right now, computed in the viewer's local time. */
export function businessStatus(biz?: BusinessInfo | null, at = new Date()): BusinessStatus | null {
  if (!biz?.enabled || !Array.isArray(biz.hours)) return null
  const dayIdx = (at.getDay() + 6) % 7 // JS Sun=0 -> Mon=0
  const cur = at.getHours() * 60 + at.getMinutes()
  const today = biz.hours.find((h) => h.day === dayIdx)
  if (today?.enabled) {
    const o = mins(today.open); const c = mins(today.close)
    if (c > o && cur >= o && cur < c) return { open: true, time: today.close, nextDay: -1 }
    if (c <= o && (cur >= o || cur < c)) return { open: true, time: today.close, nextDay: -1 } // overnight
    if (cur < o) return { open: false, time: today.open, nextDay: -1 }
  }
  // Yesterday's overnight shift may still be running.
  const yDay = biz.hours.find((h) => h.day === (dayIdx + 6) % 7)
  if (yDay?.enabled && mins(yDay.close) <= mins(yDay.open) && cur < mins(yDay.close)) {
    return { open: true, time: yDay.close, nextDay: -1 }
  }
  for (let i = 1; i <= 7; i++) {
    const d = biz.hours.find((h) => h.day === (dayIdx + i) % 7)
    if (d?.enabled) return { open: false, time: d.open, nextDay: (dayIdx + i) % 7 }
  }
  return { open: false, time: '', nextDay: -1 }
}

export function sanitizeBusiness(raw: unknown): BusinessInfo {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<BusinessInfo>
  const byDay = new Map<number, BusinessHoursDay>()
  for (const h of Array.isArray(b.hours) ? b.hours : []) {
    const day = Number((h as BusinessHoursDay).day)
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    const time = (v: unknown, fb: string) => (/^\d{1,2}:\d{2}$/.test(String(v)) ? String(v) : fb)
    byDay.set(day, {
      day,
      enabled: Boolean((h as BusinessHoursDay).enabled),
      open: time((h as BusinessHoursDay).open, '09:00'),
      close: time((h as BusinessHoursDay).close, '18:00'),
    })
  }
  return {
    enabled: Boolean(b.enabled),
    name: String(b.name || '').slice(0, 60),
    address: String(b.address || '').slice(0, 120),
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => byDay.get(day) ?? { day, enabled: false, open: '09:00', close: '18:00' }),
  }
}
