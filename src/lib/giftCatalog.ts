import crystalWolf from '../assets/gifts/crystal-wolf.jpg'
import hexCauldron from '../assets/gifts/hex-cauldron.jpg'
import moonOwl from '../assets/gifts/moon-owl.jpg'
import gingerHeart from '../assets/gifts/ginger-heart.jpg'
import instantRamen from '../assets/gifts/instant-ramen.jpg'
import honeyBear from '../assets/gifts/honey-bear.jpg'
import eternalCandle from '../assets/gifts/eternal-candle.jpg'
import glowMushroom from '../assets/gifts/glow-mushroom.jpg'
import starFrog from '../assets/gifts/star-frog.jpg'
import rubyRose from '../assets/gifts/ruby-rose.jpg'
import heartCharm from '../assets/gifts/heart-charm.jpg'
import luckyStar from '../assets/gifts/lucky-star.jpg'
import nexGem from '../assets/gifts/nex-gem.jpg'
import nexoRidersCover from '../assets/gifts/nexo-riders.png'
import nexoRidersFloating from '../assets/gifts/nexo-riders-floating.png'
import nexoRidersVideo from '../assets/gifts/nexo-riders.webm'

/** Illustrated artwork per gift model key (bundled with the app). */
export const GIFT_ART: Record<string, string> = {
  'crystal-wolf': crystalWolf,
  'hex-cauldron': hexCauldron,
  'moon-owl': moonOwl,
  'ginger-heart': gingerHeart,
  'instant-ramen': instantRamen,
  'honey-bear': honeyBear,
  'eternal-candle': eternalCandle,
  'glow-mushroom': glowMushroom,
  'star-frog': starFrog,
  'ruby-rose': rubyRose,
  'heart-charm': heartCharm,
  'lucky-star': luckyStar,
  'nex-gem': nexGem,
  'nexo-riders': nexoRidersCover,
}

/** Reveal animation per gift model key (played once when the NFT is opened). */
export const GIFT_VIDEO: Record<string, string> = {
  'nexo-riders': nexoRidersVideo,
}

export const giftArt = (key: string): string | undefined => GIFT_ART[key]

/** Transparent profile-only cutout; the original NFT artwork remains unchanged elsewhere. */
export const floatingGiftArt = (key: string): string | undefined => key === 'nexo-riders' ? nexoRidersFloating : giftArt(key)

/** Gradient aura used for regular gifts without illustrated artwork. */
export const REGULAR_GRADIENT: Record<string, string> = {
  'heart-charm': 'linear-gradient(150deg, #3b1030 0%, #701a4e 55%, #a4136b 100%)',
  'lucky-star': 'linear-gradient(150deg, #2b2103 0%, #6b5310 55%, #a97e14 100%)',
  'nex-gem': 'linear-gradient(150deg, #0a1f3d 0%, #144a8a 55%, #2f8cff 100%)',
}

/** "1,250 NEX" style number formatting (no currency symbol, NEX is virtual). */
export const fmtNex = (n: number): string => n.toLocaleString('en-US')

/** Unique collectible number, e.g. "#78,924". */
export const fmtSerial = (serial: number): string => `#${serial.toLocaleString('en-US')}`
