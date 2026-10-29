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
  // ---- Regular gifts (non-unique, sendable in chats) ----
  { key: 'ruby-rose', kind: 'regular', collection: 'Regular', name: 'Ruby Rose', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 25 },
  { key: 'heart-charm', kind: 'regular', collection: 'Regular', name: 'Heart Charm', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 30 },
  { key: 'lucky-star', kind: 'regular', collection: 'Regular', name: 'Lucky Star', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 45 },
  { key: 'nex-gem', kind: 'regular', collection: 'Regular', name: 'NEX Gem', pattern: '', background: '', rarity_model: 0, rarity_pattern: 0, rarity_background: 0, total_supply: 0, floor_price: 80 },
]

export const giftModel = (key: string): GiftModel =>
  GIFT_MODELS.find((m) => m.key === key) ?? GIFT_MODELS[0]

export const COLLECTIBLE_MODELS = GIFT_MODELS.filter((m) => m.kind === 'collectible')
export const REGULAR_MODELS = GIFT_MODELS.filter((m) => m.kind === 'regular')
export const GIFT_COLLECTIONS = [...new Set(COLLECTIBLE_MODELS.map((m) => m.collection))]

/** Deterministic store stock: unique serial numbers for the NEXO Store. */
export function storeSerial(modelIndex: number, i: number): number {
  return 12040 + modelIndex * 7919 + i * 104729
}
export const STORE_STOCK_PER_MODEL = 4
