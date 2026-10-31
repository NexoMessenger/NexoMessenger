/**
 * NEXO Gifts — shared gift catalog (display metadata).
 *
 * This is the single source of truth for gift models on the frontend and in
 * Local Demo Mode. The self-hosted server (server/index.mjs) and the Supabase
 * migration (005_gifts.sql) seed the same keys/prices — keep them in sync.
 *
 * Rarity percentages, supply and floor prices below are NEXO's own in-app
 * collectible attributes (defined by this catalog) — not blockchain data and
 * not real-world market statistics.
 */
import type { GiftModel } from './types'

export const GIFT_WELCOME_BONUS = 1000
export const GIFT_DAILY_BONUS = 250
export const GIFT_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000
/** Fee charged to the sender when transferring a collectible to another user. */
export const GIFT_TRANSFER_FEE = 25
/** Flat fee the store keeps when buying a regular gift back. */
export const GIFT_SELL_FEE = 2

export const GIFT_MODELS: GiftModel[] = [
  // ---- Arcane Pets (collectible) ----
  { key: 'crystal-wolf', kind: 'collectible', collection: 'Arcane Pets', name: 'Crystal Wolf', pattern: 'Tribal Paint', background: 'Moon Teal', rarity_model: 2, rarity_pattern: 0.5, rarity_background: 1.5, total_supply: 12000, floor_price: 1450 },
  { key: 'hex-cauldron', kind: 'collectible', collection: 'Arcane Pets', name: 'Hex Cauldron', pattern: 'Bubble Eye', background: 'Violet Mist', rarity_model: 3, rarity_pattern: 1, rarity_background: 2, total_supply: 15000, floor_price: 890 },
  { key: 'moon-owl', kind: 'collectible', collection: 'Arcane Pets', name: 'Moon Owl', pattern: 'Crescent Down', background: 'Midnight', rarity_model: 1.5, rarity_pattern: 0.8, rarity_background: 1.2, total_supply: 9000, floor_price: 1750 },
  // ---- Sweet Life (collectible) ----
  { key: 'ginger-heart', kind: 'collectible', collection: 'Sweet Life', name: 'Ginger Heart', pattern: 'Royal Icing', background: 'Peach Candy', rarity_model: 4, rarity_pattern: 1.5, rarity_background: 2.5, total_supply: 20000, floor_price: 640 },
  { key: 'instant-ramen', kind: 'collectible', collection: 'Sweet Life', name: 'Instant Ramen', pattern: 'Spicy Broth', background: 'Amber', rarity_model: 2, rarity_pattern: 0.5, rarity_background: 1.5, total_supply: 25000, floor_price: 720 },
  { key: 'honey-bear', kind: 'collectible', collection: 'Sweet Life', name: 'Honey Bear', pattern: 'Honeycomb', background: 'Honey Gold', rarity_model: 5, rarity_pattern: 2, rarity_background: 3, total_supply: 30000, floor_price: 480 },
  // ---- Glow Garden (collectible) ----
  { key: 'eternal-candle', kind: 'collectible', collection: 'Glow Garden', name: 'Eternal Candle', pattern: 'Leaf Flame', background: 'Emerald Night', rarity_model: 3, rarity_pattern: 1, rarity_background: 2, total_supply: 14000, floor_price: 980 },
  { key: 'glow-mushroom', kind: 'collectible', collection: 'Glow Garden', name: 'Glow Cap', pattern: 'Firefly Windows', background: 'Plum Dusk', rarity_model: 2.5, rarity_pattern: 1, rarity_background: 1.8, total_supply: 11000, floor_price: 1230 },
  { key: 'star-frog', kind: 'collectible', collection: 'Glow Garden', name: 'Star Frog', pattern: 'Tiny Crown', background: 'Mint Starlight', rarity_model: 1, rarity_pattern: 0.4, rarity_background: 1, total_supply: 8000, floor_price: 2100 },
  // Owner-provided artwork + reveal animation (assets/gifts/nexo-riders.*).
  { key: 'nexo-riders', kind: 'collectible', collection: 'NEXO Riders', name: 'NEXO Riders', pattern: 'Emerald Chrome', background: 'Obsidian', rarity_model: 1, rarity_pattern: 0.5, rarity_background: 1.5, total_supply: 1000, floor_price: 5000 },
  { key: 'nexo-vampire-kiss', kind: 'collectible', collection: 'NEXO Vampire Kiss', name: 'NEXO Vampire Kiss', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 2800 },
  { key: 'nexo-sailor', kind: 'collectible', collection: 'NEXO Sailor', name: 'NEXO Sailor', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 3200 },
  { key: 'nexo-tnt-pop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO TNT Pop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-mint-mug', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Mint Mug', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-midnight-noodles', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Midnight Noodles', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-freedom-socks', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Freedom Socks', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-golden-stitch', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Golden Stitch', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-velvet-ring', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Velvet Ring', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-heart-pass', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Heart Pass', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-shadow-orb', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Shadow Orb', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-dream-orb', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Dream Orb', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-golden-clover', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Golden Clover', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-flame-rocket', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Flame Rocket', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-emerald-clover', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Emerald Clover', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-ember-tree', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Ember Tree', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-jade-pup', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Jade Pup', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-lava-light', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Lava Light', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-moon-witch', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Moon Witch', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-pilot-pup', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Pilot Pup', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-dart-champion', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Dart Champion', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-frost-witch', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Frost Witch', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-tropical-treat', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Tropical Treat', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-candy-stocking', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Candy Stocking', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-matcha-scoop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Matcha Scoop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-hazard-doll', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Hazard Doll', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-disco-pup', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Disco Pup', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-matcha-bowl', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Matcha Bowl', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-golden-brew', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Golden Brew', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-cocoa-cone', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Cocoa Cone', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-sunflower-glow', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Sunflower Glow', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-crimson-crane', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Crimson Crane', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-golden-serpent', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Golden Serpent', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-neon-serpent', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Neon Serpent', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-frost-serpent', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Frost Serpent', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-butterfly-glow', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Butterfly Glow', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-pixel-pop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Pixel Pop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-star-loupe', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Star Loupe', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-spiral-pop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Spiral Pop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-kiwi-pop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Kiwi Pop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-ruby-fuzz', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Ruby Fuzz', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-cosmic-loupe', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Cosmic Loupe', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-starlight-scoop', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Starlight Scoop', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-frog-box', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Frog Box', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-geo-forest', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Geo Forest', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-geo-berry', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Geo Berry', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-geo-ocean', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Geo Ocean', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-rose-cap', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Rose Cap', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-rose-peach', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Rose Peach', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-amber-peach', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Amber Peach', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-rainbow-cap', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Rainbow Cap', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  { key: 'nexo-spectrum-peach', kind: 'collectible', collection: 'NEXO Kaleidoscope', name: 'NEXO Spectrum Peach', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 1500 },
  // ---- Regular gifts (non-unique, sendable in chats) ----
  { key: 'ruby-rose', kind: 'regular', collection: 'Regular', name: 'Ruby Rose', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 25 },
  { key: 'heart-charm', kind: 'regular', collection: 'Regular', name: 'Heart Charm', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 30 },
  { key: 'lucky-star', kind: 'regular', collection: 'Regular', name: 'Lucky Star', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 45 },
  { key: 'nex-gem', kind: 'regular', collection: 'Regular', name: 'NEX Gem', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 80 },
  { key: 'nexo-party-bear', kind: 'regular', collection: 'Regular', name: 'NEXO Party Bear', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 50 },
]

export const giftModel = (key: string): GiftModel =>
  GIFT_MODELS.find((m) => m.key === key) ?? GIFT_MODELS[0]

export const COLLECTIBLE_MODELS = GIFT_MODELS.filter((m) => m.kind === 'collectible')
export const REGULAR_MODELS = GIFT_MODELS.filter((m) => m.kind === 'regular')
export const GIFT_COLLECTIONS = [...new Set(COLLECTIBLE_MODELS.map((m) => m.collection))]

/** One-time promo codes (gift-card style): each can be redeemed exactly
 *  once, by any account, only through the backend. Keep this list in sync
 *  with server/index.mjs and supabase/migrations/007_promo_codes.sql. */
export const PROMO_CODES: { code: string; amount: number }[] = [
  { code: 'NEXO-MEGA-K7Q2', amount: 10000 },
  { code: 'NEXO-MEGA-R4XD', amount: 10000 },
  { code: 'NEXO-STAR-P9TA', amount: 5000 },
  { code: 'NEXO-STAR-W3KE', amount: 5000 },
  { code: 'NEXO-MOON-D8ZH', amount: 2500 },
  { code: 'NEXO-MOON-B6NF', amount: 2500 },
  { code: 'NEXO-GIFT-X2QR', amount: 1000 },
  { code: 'NEXO-GIFT-M5VC', amount: 1000 },
  { code: 'NEXO-GIFT-T9HA', amount: 1000 },
  { code: 'NEXO-GIFT-K4JW', amount: 1000 },
  { code: 'NEXO-BONUS-S7PD', amount: 500 },
  { code: 'NEXO-BONUS-F2YG', amount: 500 },
  { code: 'NEXO-BONUS-Q8ME', amount: 500 },
  { code: 'NEXO-BONUS-H3XT', amount: 500 },
]

/** Codes compare case/dash-insensitively: "nexo mega k7q2" works too. */
export const normalizePromoCode = (raw: string): string =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Deterministic store stock: unique serial numbers for the NEXO Store. */
export function storeSerial(modelIndex: number, i: number): number {
  return 12040 + modelIndex * 7919 + i * 104729
}
export const STORE_STOCK_PER_MODEL = 4
