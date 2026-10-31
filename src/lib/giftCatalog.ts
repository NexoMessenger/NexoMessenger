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
import vampireKissCover from '../assets/gifts/nexo-vampire-kiss.jpg'
import vampireKissFloating from '../assets/gifts/nexo-vampire-kiss-floating.png'
import vampireKissVideo from '../assets/gifts/15783.webm'
import sailorCover from '../assets/gifts/nexo-sailor-cover.jpg'
import sailorFloating from '../assets/gifts/nexo-sailor-floating.png'
import sailorVideo from '../assets/gifts/Screen_Recording_20261029_221839.mp4'

import art0 from '../assets/gifts/constellation/tnt-pop.jpg'
import art1 from '../assets/gifts/constellation/mint-mug.jpg'
import art2 from '../assets/gifts/constellation/midnight-noodles.jpg'
import art3 from '../assets/gifts/constellation/freedom-socks.jpg'
import art4 from '../assets/gifts/constellation/golden-stitch.jpg'
import art5 from '../assets/gifts/constellation/velvet-ring.jpg'
import art6 from '../assets/gifts/constellation/heart-pass.jpg'
import art7 from '../assets/gifts/constellation/shadow-orb.jpg'
import art8 from '../assets/gifts/constellation/dream-orb.jpg'
import art9 from '../assets/gifts/constellation/golden-clover.jpg'
import art10 from '../assets/gifts/constellation/flame-rocket.jpg'
import art11 from '../assets/gifts/constellation/emerald-clover.jpg'
import art12 from '../assets/gifts/constellation/ember-tree.jpg'
import art13 from '../assets/gifts/constellation/jade-pup.jpg'
import art14 from '../assets/gifts/constellation/lava-light.jpg'

import extraArt0 from '../assets/gifts/kaleidoscope-extra/moon-witch.jpg'
import extraArt1 from '../assets/gifts/kaleidoscope-extra/pilot-pup.jpg'
import extraArt2 from '../assets/gifts/kaleidoscope-extra/dart-champion.jpg'
import extraArt3 from '../assets/gifts/kaleidoscope-extra/frost-witch.jpg'
import extraArt4 from '../assets/gifts/kaleidoscope-extra/tropical-treat.jpg'
import extraArt5 from '../assets/gifts/kaleidoscope-extra/candy-stocking.jpg'
import extraArt6 from '../assets/gifts/kaleidoscope-extra/matcha-scoop.jpg'
import extraArt7 from '../assets/gifts/kaleidoscope-extra/hazard-doll.jpg'
import extraArt8 from '../assets/gifts/kaleidoscope-extra/disco-pup.jpg'
import extraArt9 from '../assets/gifts/kaleidoscope-extra/matcha-bowl.jpg'
import extraArt10 from '../assets/gifts/kaleidoscope-extra/golden-brew.jpg'
import extraArt11 from '../assets/gifts/kaleidoscope-extra/cocoa-cone.jpg'
import extraArt12 from '../assets/gifts/kaleidoscope-extra/sunflower-glow.jpg'
import extraArt13 from '../assets/gifts/kaleidoscope-extra/crimson-crane.jpg'
import extraArt14 from '../assets/gifts/kaleidoscope-extra/golden-serpent.jpg'
import extraArt15 from '../assets/gifts/kaleidoscope-extra/neon-serpent.jpg'
import extraArt16 from '../assets/gifts/kaleidoscope-extra/frost-serpent.jpg'
import extraArt17 from '../assets/gifts/kaleidoscope-extra/butterfly-glow.jpg'
import extraArt18 from '../assets/gifts/kaleidoscope-extra/pixel-pop.jpg'
import extraArt19 from '../assets/gifts/kaleidoscope-extra/star-loupe.jpg'
import extraArt20 from '../assets/gifts/kaleidoscope-extra/spiral-pop.jpg'
import extraArt21 from '../assets/gifts/kaleidoscope-extra/kiwi-pop.jpg'
import extraArt22 from '../assets/gifts/kaleidoscope-extra/ruby-fuzz.jpg'
import extraArt23 from '../assets/gifts/kaleidoscope-extra/cosmic-loupe.jpg'
import extraArt24 from '../assets/gifts/kaleidoscope-extra/starlight-scoop.jpg'
import extraArt25 from '../assets/gifts/kaleidoscope-extra/frog-box.jpg'
import extraArt26 from '../assets/gifts/kaleidoscope-extra/geo-forest.jpg'
import extraArt27 from '../assets/gifts/kaleidoscope-extra/geo-berry.jpg'
import extraArt28 from '../assets/gifts/kaleidoscope-extra/geo-ocean.jpg'
import extraArt29 from '../assets/gifts/kaleidoscope-extra/rose-cap.jpg'
import extraArt30 from '../assets/gifts/kaleidoscope-extra/rose-peach.jpg'
import extraArt31 from '../assets/gifts/kaleidoscope-extra/amber-peach.jpg'
import extraArt32 from '../assets/gifts/kaleidoscope-extra/rainbow-cap.jpg'
import extraArt33 from '../assets/gifts/kaleidoscope-extra/spectrum-peach.jpg'
import extraArt34 from '../assets/gifts/kaleidoscope-extra/party-bear.jpg'

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
  'nexo-vampire-kiss': vampireKissCover,
  'nexo-sailor': sailorCover,
  'nexo-moon-witch': extraArt0,
  'nexo-pilot-pup': extraArt1,
  'nexo-dart-champion': extraArt2,
  'nexo-frost-witch': extraArt3,
  'nexo-tropical-treat': extraArt4,
  'nexo-candy-stocking': extraArt5,
  'nexo-matcha-scoop': extraArt6,
  'nexo-hazard-doll': extraArt7,
  'nexo-disco-pup': extraArt8,
  'nexo-matcha-bowl': extraArt9,
  'nexo-golden-brew': extraArt10,
  'nexo-cocoa-cone': extraArt11,
  'nexo-sunflower-glow': extraArt12,
  'nexo-crimson-crane': extraArt13,
  'nexo-golden-serpent': extraArt14,
  'nexo-neon-serpent': extraArt15,
  'nexo-frost-serpent': extraArt16,
  'nexo-butterfly-glow': extraArt17,
  'nexo-pixel-pop': extraArt18,
  'nexo-star-loupe': extraArt19,
  'nexo-spiral-pop': extraArt20,
  'nexo-kiwi-pop': extraArt21,
  'nexo-ruby-fuzz': extraArt22,
  'nexo-cosmic-loupe': extraArt23,
  'nexo-starlight-scoop': extraArt24,
  'nexo-frog-box': extraArt25,
  'nexo-geo-forest': extraArt26,
  'nexo-geo-berry': extraArt27,
  'nexo-geo-ocean': extraArt28,
  'nexo-rose-cap': extraArt29,
  'nexo-rose-peach': extraArt30,
  'nexo-amber-peach': extraArt31,
  'nexo-rainbow-cap': extraArt32,
  'nexo-spectrum-peach': extraArt33,
  'nexo-party-bear': extraArt34,
  'nexo-tnt-pop': art0,
  'nexo-mint-mug': art1,
  'nexo-midnight-noodles': art2,
  'nexo-freedom-socks': art3,
  'nexo-golden-stitch': art4,
  'nexo-velvet-ring': art5,
  'nexo-heart-pass': art6,
  'nexo-shadow-orb': art7,
  'nexo-dream-orb': art8,
  'nexo-golden-clover': art9,
  'nexo-flame-rocket': art10,
  'nexo-emerald-clover': art11,
  'nexo-ember-tree': art12,
  'nexo-jade-pup': art13,
  'nexo-lava-light': art14,
}

/** Reveal animation per gift model key (played once when the NFT is opened). */
export const GIFT_VIDEO: Record<string, string> = {
  'nexo-riders': nexoRidersVideo,
  'nexo-vampire-kiss': vampireKissVideo,
  'nexo-sailor': sailorVideo,
}

export const giftArt = (key: string): string | undefined => GIFT_ART[key]

/** Transparent profile-only cutouts; store and detail artwork remain unchanged. */
const FLOATING_GIFT_ART: Record<string, string> = {
  'nexo-riders': nexoRidersFloating,
  'nexo-vampire-kiss': vampireKissFloating,
  'nexo-sailor': sailorFloating,
}
export const floatingGiftArt = (key: string): string | undefined => FLOATING_GIFT_ART[key] || giftArt(key)

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
