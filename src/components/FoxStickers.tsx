import { useId, useState, type ReactNode } from 'react'
import { useI18n, type TranslationKey } from '../i18n'

export type FoxVariant =
  | 'happy' | 'laugh' | 'sad' | 'angry' | 'surprised' | 'love' | 'wave' | 'bye'
  | 'sleepy' | 'thumbsup' | 'thanks' | 'celebrate' | 'confused' | 'facepalm' | 'heart' | 'cool'

export const STICKERS: { key: FoxVariant; nameKey: TranslationKey }[] = [
  { key: 'happy', nameKey: 'sticker.happy' },
  { key: 'laugh', nameKey: 'sticker.laugh' },
  { key: 'sad', nameKey: 'sticker.sad' },
  { key: 'angry', nameKey: 'sticker.angry' },
  { key: 'surprised', nameKey: 'sticker.surprised' },
  { key: 'love', nameKey: 'sticker.love' },
  { key: 'wave', nameKey: 'sticker.wave' },
  { key: 'bye', nameKey: 'sticker.bye' },
  { key: 'sleepy', nameKey: 'sticker.sleepy' },
  { key: 'thumbsup', nameKey: 'sticker.thumbsup' },
  { key: 'thanks', nameKey: 'sticker.thanks' },
  { key: 'celebrate', nameKey: 'sticker.celebrate' },
  { key: 'confused', nameKey: 'sticker.confused' },
  { key: 'facepalm', nameKey: 'sticker.facepalm' },
  { key: 'heart', nameKey: 'sticker.heart' },
  { key: 'cool', nameKey: 'sticker.cool' },
]

const INK = '#33241A'
const CREAM = '#FFF6EA'

/**
 * Original NEXO fox mascot — one consistent character (same head, ears, muzzle
 * and palette) whose eyes, mouth, brows and props change per emotion.
 * Pure inline SVG: transparent background, crisp at any size, zero assets.
 */
export function FoxSticker({ variant, size = 96 }: { variant: string; size?: number }) {
  const v = (STICKERS.some((s) => s.key === variant) ? variant : 'happy') as FoxVariant
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = `foxg${uid}`

  let eyes: ReactNode = null
  let mouth: ReactNode = null
  let brows: ReactNode = null
  let extra: ReactNode = null

  const eyeHappy = (<><path d="M38 62q6-7 12 0" /><path d="M70 62q6-7 12 0" /></>)
  const eyeDots = (<><circle cx="44" cy="62" r="3.6" fill={INK} stroke="none" /><circle cx="76" cy="62" r="3.6" fill={INK} stroke="none" /></>)

  switch (v) {
    case 'happy':
      eyes = eyeHappy; mouth = <path d="M52 84q8 7 16 0" />; break
    case 'laugh':
      eyes = (<><path d="M36 64l10-6M36 58l10 6" /><path d="M74 64l10-6M74 58l10 6" /></>)
      mouth = <path d="M48 80q12 14 24 0q-3 12-12 12t-12-12Z" fill={INK} stroke="none" />; break
    case 'sad':
      eyes = eyeDots; brows = (<><path d="M36 52l13 5M84 52l-13 5" /></>)
      mouth = <path d="M52 90q8-6 16 0" />
      extra = <path d="M86 68q5 7 0 10q-5-3 0-10Z" fill="#7DD3FC" stroke="none" />; break
    case 'angry':
      eyes = eyeDots; brows = (<><path d="M35 50l14 7M85 50l-14 7" strokeWidth="3.4" /></>)
      mouth = <path d="M53 88h14" />
      extra = <path d="M95 34l3-6M99 40l6-3M92 28l1-7" stroke="#F87171" />; break
    case 'surprised':
      eyes = (<><circle cx="44" cy="61" r="5" fill={INK} stroke="none" /><circle cx="76" cy="61" r="5" fill={INK} stroke="none" /></>)
      brows = (<><path d="M36 50q8-5 14-1M70 49q6-4 14 1" /></>)
      mouth = <ellipse cx="60" cy="86" rx="6" ry="7.5" fill={INK} stroke="none" />; break
    case 'love': {
      const heart = (x: number, y: number, s: number) => (
        <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 4C0 1 3-1 5.5 1C8-1 11 1 11 4C11 8 5.5 12 5.5 12S0 8 0 4Z" fill="#F472B6" stroke="none" />
      )
      eyes = (<>{heart(38, 55, 1)}{heart(70, 55, 1)}</>)
      mouth = <path d="M52 83q8 8 16 0" />
      extra = (<>{heart(94, 22, 0.9)}{heart(8, 14, 0.7)}</>); break
    }
    case 'wave':
      eyes = eyeHappy; mouth = <path d="M52 84q8 7 16 0" />
      extra = (<g><ellipse cx="104" cy="52" rx="8" ry="13" transform="rotate(24 104 52)" /><path d="M96 30q10-6 16 2M100 22q8-8 16-2" stroke="#A78BFA" /></g>); break
    case 'bye':
      eyes = eyeHappy; mouth = <path d="M53 85q7 5 14 0" />
      extra = (<g><ellipse cx="15" cy="54" rx="8" ry="13" transform="rotate(-24 15 54)" /><path d="M22 28Q14 20 6 24M26 36Q18 30 10 32" stroke="#A78BFA" /></g>); break
    case 'sleepy':
      eyes = (<><path d="M38 62q6 5 12 0M70 62q6 5 12 0" /></>)
      mouth = <ellipse cx="60" cy="86" rx="4.5" ry="3.4" />
      extra = (<g fill="#A78BFA" stroke="none" fontFamily="Arial, sans-serif" fontWeight="800"><text x="92" y="34" fontSize="17">Z</text><text x="102" y="20" fontSize="12">Z</text></g>); break
    case 'thumbsup':
      eyes = eyeHappy; mouth = <path d="M52 84q8 7 16 0" />
      extra = (<g><path d="M92 78c6-1 9-5 8-10l-1-6 7-9c2-3-1-7-4-5l-8 5-2-9c-1-3-6-3-7 0l-3 14c-6-1-9 2-8 7l2 12c1 5 4 7 9 6l7-1Z" fill="#F59E0B" stroke={INK} strokeWidth="2" /></g>); break
    case 'thanks':
      eyes = eyeHappy; mouth = <path d="M53 84q7 6 14 0" />
      extra = (<g><ellipse cx="48" cy="100" rx="9" ry="6" transform="rotate(-18 48 100)" /><ellipse cx="72" cy="100" rx="9" ry="6" transform="rotate(18 72 100)" /><path d="M98 26l1.8 4.2L104 32l-4.2 1.8L98 38l-1.8-4.2L92 32l4.2-1.8L98 26ZM20 18l1.4 3.2L24.6 22.6l-3.2 1.4L20 27.2l-1.4-3.2-3.2-1.4 3.2-1.4L20 18Z" fill="#A78BFA" stroke="none" /></g>); break
    case 'celebrate':
      eyes = eyeHappy
      mouth = <path d="M50 81q10 11 20 0q-2 10-10 10t-10-10Z" fill={INK} stroke="none" />
      extra = (<g><path d="M60 2l9 20H51L60 2Z" fill="#8B5CF6" stroke="none" /><circle cx="60" cy="3" r="4" fill="#F472B6" stroke="none" /><rect x="10" y="14" width="5" height="9" rx="2" fill="#7DD3FC" stroke="none" transform="rotate(-18 12 18)" /><rect x="104" y="20" width="5" height="9" rx="2" fill="#FBBF24" stroke="none" transform="rotate(16 106 24)" /><circle cx="16" cy="38" r="2.6" fill="#F472B6" stroke="none" /><circle cx="106" cy="44" r="2.6" fill="#7DD3FC" stroke="none" /></g>); break
    case 'confused':
      eyes = eyeDots; brows = (<><path d="M36 50q8-6 14-2M72 54q6-2 12 1" /></>)
      mouth = <path d="M53 88q7-4 14 1" />
      extra = <text x="94" y="36" fontSize="26" fontWeight="800" fill="#A78BFA" stroke="none" fontFamily="Arial, sans-serif">?</text>; break
    case 'facepalm':
      eyes = (<><path d="M70 62q6 5 12 0" /></>)
      mouth = <path d="M64 90q7-4 13 0" />
      extra = (<g><ellipse cx="46" cy="66" rx="13" ry="17" transform="rotate(-14 46 66)" fill="#F59E0B" stroke={INK} strokeWidth="2" /><path d="M38 54v10M46 52v12M54 54v10" stroke={INK} strokeWidth="1.6" /></g>); break
    case 'heart':
      eyes = eyeHappy; mouth = <path d="M55 78q5 4 10 0" />
      extra = (<g><path d="M60 108C38 94 28 82 28 70a11 11 0 0 1 20-6 11 11 0 0 1 20 6c0 12-10 24-8 38Z" fill="#F43F5E" stroke="none" transform="translate(0 -6)" /><ellipse cx="34" cy="96" rx="8" ry="5.5" transform="rotate(-20 34 96)" /><ellipse cx="86" cy="96" rx="8" ry="5.5" transform="rotate(20 86 96)" /></g>); break
    case 'cool':
      eyes = (<g fill={INK} stroke="none"><rect x="30" y="54" width="24" height="13" rx="6" /><rect x="66" y="54" width="24" height="13" rx="6" /><rect x="52" y="59" width="16" height="3.4" /></g>)
      mouth = <path d="M53 86q8 5 15-1" />; break
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" role="img" aria-label="NEXO fox sticker"
      stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id={g} x1="24" y1="16" x2="96" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB25E" /><stop offset="1" stopColor="#F07F2E" />
        </linearGradient>
      </defs>
      {/* ears */}
      <path d="M30 44 24 10l26 18Z" fill={`url(#${g})`} />
      <path d="M90 44l6-34-26 18Z" fill={`url(#${g})`} />
      <path d="M29 34l-2-15 13 9Z" fill={CREAM} stroke="none" />
      <path d="M91 34l2-15-13 9Z" fill={CREAM} stroke="none" />
      {/* head */}
      <path d="M60 20c22 0 38 16 38 42 0 25-17 42-38 42S22 87 22 62c0-26 16-42 38-42Z" fill={`url(#${g})`} />
      {/* cheeks + muzzle */}
      <path d="M60 104c-14 0-26-8-31-20 8 4 14 1 19-4 3 5 7 7 12 7s9-2 12-7c5 5 11 8 19 4-5 12-17 20-31 20Z" fill={CREAM} stroke="none" />
      <ellipse cx="60" cy="88" rx="17" ry="11" fill={CREAM} stroke="none" />
      <path d="M54 79h12l-6 7-6-7Z" fill={INK} stroke="none" />
      {brows}{eyes}{mouth}{extra}
    </svg>
  )
}

/** Grid picker with large preview + explicit Send (mobile friendly). */
export function StickerPicker({ onSend }: { onSend: (stickerKey: string) => void }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<FoxVariant>('happy')
  const current = STICKERS.find((s) => s.key === selected)!
  return (
    <div className="sticker-panel glass">
      <div className="sticker-panel-head">
        <span className="sticker-panel-title">{t('stickers.title')}</span>
        <span className="pill pill-accent">NEXO Fox</span>
      </div>
      <div className="sticker-preview">
        <FoxSticker variant={selected} size={92} />
        <div className="sticker-preview-meta">
          <div className="sticker-preview-name">{t(current.nameKey)}</div>
          <button className="btn btn-primary btn-sm" onClick={() => onSend(selected)}>{t('stickers.send')}</button>
        </div>
      </div>
      <div className="sticker-grid">
        {STICKERS.map((s) => (
          <button key={s.key} className={`sticker-cell ${selected === s.key ? 'active' : ''}`}
            onClick={() => setSelected(s.key)} aria-label={t(s.nameKey)} title={t(s.nameKey)}
            aria-pressed={selected === s.key}>
            <FoxSticker variant={s.key} size={52} />
          </button>
        ))}
      </div>
    </div>
  )
}
