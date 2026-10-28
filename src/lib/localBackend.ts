import type {
  Channel, ChannelMember, ChannelPost, ConvMember, Conversation,
  Group, GroupMember, GroupMessage, Message, Profile, UserSettings,
} from './types'

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
  settings: UserSettings[]
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
    settings: [], sessionUserId: null,
  }
}

export function loadDB(): LocalDB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as LocalDB
  } catch { /* fall through to seed */ }
  const db = seed()
  saveDB(db, false)
  return db
}
export function saveDB(db: LocalDB, notify = true) {
  localStorage.setItem(KEY, JSON.stringify(db))
  if (notify) emit()
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  if (salt === 'demo' && password === 'demo1234') return ''
  const data = new TextEncoder().encode(salt + ':' + password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
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
