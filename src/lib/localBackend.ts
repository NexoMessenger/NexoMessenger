import type {
  Channel, ChannelMember, ChannelPost, ConvMember, Conversation, Reaction,
  GiftItem, GiftListing, GiftTxn,
  Group, GroupMember, GroupMessage, Message, Profile, ProfilePost, UserSettings,
} from './types'
import { COLLECTIBLE_MODELS, PROMO_CODES, STORE_STOCK_PER_MODEL, storeSerial } from './giftData'

/**
 * LOCAL DEMO BACKEND — used ONLY when Supabase env vars are missing.
 * Data lives in this browser (localStorage) and syncs between tabs via
 * BroadcastChannel. It is NOT a production backend and is labelled as such
 * in the UI. When VITE_SUPABASE_URL/ANON_KEY are set, src/lib/supabase.ts
 * takes over and this module is never used for data.
 */

export interface LocalUser {
  id: string
  email: string
  passwordHash: string
  salt: string
}

export interface LocalGiftWallet { balance: number; last_bonus_at: string }
export interface LocalGiftState {
  wallets: Record<string, LocalGiftWallet>
  items: GiftItem[]
  listings: GiftListing[]
  regular: Record<string, Record<string, number>>
  txns: (GiftTxn & { user_id: string })[]
  seq: number
  stocked: string[]
  promo: { code: string; amount: number; redeemed_by: string | null; redeemed_at: string }[]
}

export function giftSeedState(): LocalGiftState {
  const items: GiftItem[] = []
  COLLECTIBLE_MODELS.forEach((m, mi) => {
    for (let i = 0; i < STORE_STOCK_PER_MODEL; i++) {
      items.push({ id: uid(), serial: storeSerial(mi, i), model_key: m.key, owner_id: null })
    }
  })
  return {
    wallets: {}, items, listings: [], regular: {}, txns: [], seq: 1,
    stocked: COLLECTIBLE_MODELS.map((m) => m.key),
    promo: PROMO_CODES.map((p) => ({ ...p, redeemed_by: null, redeemed_at: '' })),
  }
}

/** Store stock for catalog models added later — granted exactly once per DB. */
export function backfillGiftStock(db: LocalDB) {
  const g = db.gifts
  if (!Array.isArray(g.stocked)) {
    g.stocked = COLLECTIBLE_MODELS.filter((m) => g.items.some((i) => i.model_key === m.key)).map((m) => m.key)
  }
  COLLECTIBLE_MODELS.forEach((m, mi) => {
    if (!g.stocked.includes(m.key)) {
      for (let i = 0; i < STORE_STOCK_PER_MODEL; i++) {
        g.items.push({ id: uid(), serial: storeSerial(mi, i), model_key: m.key, owner_id: null })
      }
      g.stocked.push(m.key)
    }
  })
}

export interface LocalDB {
  users: LocalUser[]
  profiles: Profile[]
  conversations: Conversation[]
  convMembers: ConvMember[]
  messages: Message[]
  groups: Group[]
  groupMembers: GroupMember[]
  groupMessages: GroupMessage[]
  channels: Channel[]
  channelMembers: ChannelMember[]
  posts: ChannelPost[]
  profilePosts: ProfilePost[]
  reactions: Reaction[]
  settings: UserSettings[]
  gifts: LocalGiftState
  sessionUserId: string | null
}

const KEY = 'nexo_local_db_v1'
const listeners = new Set<() => void>()
let bc: BroadcastChannel | null = null
try { bc = new BroadcastChannel('nexo_local_events') } catch { bc = null }
if (bc) bc.onmessage = () => listeners.forEach((f) => f())
window.addEventListener('storage', (e) => { if (e.key === KEY) listeners.forEach((f) => f()) })

export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit() {
  listeners.forEach((f) => f())
  try { bc?.postMessage({ t: Date.now() }) } catch { /* noop */ }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
const now = () => new Date().toISOString()

function seed(): LocalDB {
  const t = now()
  const assistant: Profile = {
    id: 'u_assistant', username: 'nexo', display_name: 'NEXO Assistant',
    avatar_url: '', bio: 'Official NEXO assistant. Say hi — I reply instantly in demo mode.',
    is_online: true, last_seen: t, created_at: t,
  }
  const seedProfiles: Profile[] = [
    assistant,
    { id: 'u_mira', username: 'Mira', display_name: 'Mira Chen', avatar_url: '', bio: 'Product designer · Berlin', is_online: true, last_seen: t, created_at: t },
    { id: 'u_kai', username: 'Kai', display_name: 'Kai Morgan', avatar_url: '', bio: 'Building things for the web', is_online: false, last_seen: t, created_at: t },
    { id: 'u_lena', username: 'lena', display_name: 'Lena Hoffmann', avatar_url: '', bio: 'Photography & travel', is_online: true, last_seen: t, created_at: t },
  ]
  const design: Group = { id: 'g_design', name: 'Design Circle', avatar_url: '', description: 'Premium UI, glassmorphism and motion.', owner_id: 'u_mira', is_public: true, created_at: t, last_message_at: t }
  const news: Channel = { id: 'c_news', name: 'NEXO Updates', avatar_url: '', description: 'Official announcements from the NEXO team.', owner_id: 'u_assistant', is_public: true, created_at: t }
  return {
    users: [{ id: 'demo_user', email: 'demo@nexo.app', passwordHash: '', salt: 'demo' }],
    profiles: [
      { id: 'demo_user', username: 'demo', display_name: 'Demo User', avatar_url: '', bio: 'Trying out NEXO Messenger', is_online: false, last_seen: t, created_at: t },
      ...seedProfiles,
    ],
    conversations: [], convMembers: [], messages: [],
    groups: [design],
    groupMembers: [
      { group_id: 'g_design', user_id: 'u_mira', role: 'owner', last_read_at: t, joined_at: t },
      { group_id: 'g_design', user_id: 'u_kai', role: 'member', last_read_at: t, joined_at: t },
      { group_id: 'g_design', user_id: 'u_lena', role: 'member', last_read_at: t, joined_at: t },
    ],
    groupMessages: [
      { id: uid(), group_id: 'g_design', sender_id: 'u_mira', body: 'Welcome to Design Circle — share your latest glass UI experiments here.', attachment_url: '', attachment_name: '', attachment_type: '', created_at: t },
    ],
    channels: [news],
    channelMembers: [{ channel_id: 'c_news', user_id: 'u_assistant', role: 'owner', can_post: true, joined_at: t }],
    posts: [{ id: uid(), channel_id: 'c_news', author_id: 'u_assistant', body: 'Welcome to NEXO Messenger. This is a public channel — subscribe to receive broadcasts.', attachment_url: '', attachment_name: '', attachment_type: '', created_at: t }],
    profilePosts: [],
    settings: [], reactions: [], gifts: giftSeedState(), sessionUserId: null,
  }
}

export function loadDB(): LocalDB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as LocalDB
      // Backfill collections added in later versions (existing user data is preserved).
      if (!Array.isArray(db.reactions)) db.reactions = []
      if (!Array.isArray(db.profilePosts)) db.profilePosts = []
      // Profile archive was removed; un-hide anything archived before.
      db.profilePosts.forEach((p) => { p.archived = false })
      if (!db.gifts || !Array.isArray(db.gifts.items)) db.gifts = giftSeedState()
      backfillGiftStock(db)
      // Promo codes added later appear in existing DBs too (unredeemed).
      if (!Array.isArray(db.gifts.promo)) db.gifts.promo = []
      for (const pc of PROMO_CODES) {
        if (!db.gifts.promo.some((x) => x.code === pc.code)) {
          db.gifts.promo.push({ ...pc, redeemed_by: null, redeemed_at: '' })
        }
      }
      return db
    }
  } catch { /* fall through to seed */ }
  const db = seed()
  saveDB(db, false)
  return db
}
export function saveDB(db: LocalDB, notify = true) {
  const raw = JSON.stringify(db)
  // No-op write guard: identical state must not re-notify listeners.
  // (Prevents realtime feedback loops: load -> mark-read -> emit -> load -> ...)
  try { if (localStorage.getItem(KEY) === raw) return } catch { /* storage unavailable */ }
  localStorage.setItem(KEY, raw)
  if (notify) emit()
}

// __SHA256_START__
/** Pure-JS SHA-256 (identical output to WebCrypto) — fallback for insecure
 *  contexts (plain http:// on a non-localhost IP), where crypto.subtle is
 *  undefined and digest() would crash registration in Local Demo Mode. */
function sha256Hex(input: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  const paddedLen = (((input.length + 8) >> 6) + 1) << 6
  const msg = new Uint8Array(paddedLen)
  msg.set(input)
  msg[input.length] = 0x80
  const dv = new DataView(msg.buffer)
  dv.setUint32(paddedLen - 4, (input.length * 8) >>> 0)
  dv.setUint32(paddedLen - 8, Math.floor(input.length / 0x20000000))
  const w = new Uint32Array(64)
  for (let block = 0; block < paddedLen; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(block + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0
      d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}
// __SHA256_END__

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (salt === 'demo' && password === 'demo1234') return ''
  const data = new TextEncoder().encode(salt + ':' + password)
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle
  if (typeof subtle?.digest === 'function') {
    const digest = await subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Plain http:// on a non-localhost origin: WebCrypto is unavailable.
  // Same hash, computed in JS — demo registration/login must not crash.
  return sha256Hex(data)
}

/** Assistant auto-reply so a single user can feel realtime in demo mode. */
export function maybeAssistantReply(db: LocalDB, conversationId: string, fromUserId: string) {
  const members = db.convMembers.filter((m) => m.conversation_id === conversationId)
  const isAssistantChat = members.some((m) => m.user_id === 'u_assistant') && members.length === 2
  if (!isAssistantChat) return
  setTimeout(() => {
    const fresh = loadDB()
    if (!fresh.profiles.find((p) => p.id === fromUserId)) return
    fresh.messages.push({
      id: uid(), conversation_id: conversationId, sender_id: 'u_assistant',
      body: 'Got it ✓ This reply is generated locally in Demo Mode. Connect Supabase (see README) for real multi-device messaging.',
      attachment_url: '', attachment_name: '', attachment_type: '', created_at: now(),
    })
    const conv = fresh.conversations.find((c) => c.id === conversationId)
    if (conv) conv.last_message_at = now()
    saveDB(fresh)
  }, 900)
}
