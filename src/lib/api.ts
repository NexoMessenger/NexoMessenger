import { supabase, backendMode, apiBase } from './supabase'
import { loadDB, saveDB, uid, hashPassword, onLocalChange, maybeAssistantReply, type LocalDB } from './localBackend'
import { giftModel, normalizePromoCode, GIFT_WELCOME_BONUS, GIFT_DAILY_BONUS, GIFT_BONUS_INTERVAL_MS, GIFT_TRANSFER_FEE, GIFT_SELL_FEE } from './giftData'
import { EMOJI_STATUSES, NAME_COLORS, PREMIUM_DAYS, PREMIUM_PRICE_RUB, PROFILE_FONTS, PROFILE_THEMES, isPremiumActive, normalizePremiumCode, sanitizeBusiness } from './premiumData'
import type {
  AttachmentInfo, Channel, ChannelPost, Conversation, GiftListing, GiftState, Group, GroupMessage,
  BgGift, BusinessInfo, MarketEntry, Message, OwnedGift, PremiumState, Profile, ProfileMusic, ProfilePost, Reaction, ReactionScope, UserGifts, UserSettings,
} from './types'

export const mode = backendMode
const now = () => new Date().toISOString()
const isSb = () => backendMode === 'supabase'
const isSrv = () => backendMode === 'server'

/* ===================== own-server transport ===================== */
const TOKEN_KEY = 'nexo_server_token'
const authListeners = new Set<() => void>()
function getServerToken(): string | null { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
function setServerToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* noop */ }
  authListeners.forEach((f) => f())
}
async function srv<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const tok = getServerToken()
  if (tok && opts.auth !== false) headers.Authorization = `Bearer ${tok}`
  const res = await fetch(`${apiBase}${path}`, {
    method: opts.method || 'GET', headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) err(data.error || `Request failed (${res.status})`)
  return data as T
}
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = reject
  r.readAsDataURL(file)
})

function err(msg: string): never { throw new Error(msg) }

/** Web Push is available only on the self-hosted HTTPS site. */
export function pushSupported(): boolean {
  return isSrv() && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
export async function pushIsEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration(new URL('push-sw.js', document.baseURI).href)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return false
  return (await srv<{ enabled: boolean }>('/api/push/status', { method: 'POST', body: { endpoint: sub.endpoint } })).enabled
}
export async function enablePush(locale: string): Promise<void> {
  if (!pushSupported()) throw new Error('Push notifications are not supported here.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  const { publicKey } = await srv<{ publicKey: string }>('/api/push/key')
  const reg = await navigator.serviceWorker.register(new URL('push-sw.js', document.baseURI).href)
  const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4)), c => c.charCodeAt(0))
  let sub = await reg.pushManager.getSubscription()
  if (sub && sub.options.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') !== publicKey) { await sub.unsubscribe(); sub = null }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  await srv('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), locale } })
}
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration(new URL('push-sw.js', document.baseURI).href)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await srv('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } })
  await sub.unsubscribe()
}

/* ============================== AUTH ============================== */

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isSrv()) {
    if (!getServerToken()) return null
    try { return (await srv<{ profile: Profile }>('/api/me')).profile }
    catch { setServerToken(null); return null }
  }
  if (isSb()) {
    const { data } = await supabase!.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const { data: p } = await supabase!.from('profiles').select('*').eq('id', user.id).single()
    if (p) return p as Profile
    // First Google login etc.: create profile from metadata
    const meta = user.user_metadata || {}
    const base = String(meta.username || (user.email?.split('@')[0] || 'user')).toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20) || 'user'
    let username = base
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase!.from('profiles').select('id').eq('username', username).maybeSingle()
      if (!taken) break
      username = `${base}${Math.floor(Math.random() * 9000 + 1000)}`
    }
    const fresh: Profile = {
      id: user.id, username, display_name: meta.display_name || meta.full_name || meta.name || username,
      avatar_url: meta.avatar_url || meta.picture || '', bio: '', is_online: true, last_seen: now(), created_at: now(),
    }
    const { error } = await supabase!.from('profiles').insert(fresh)
    if (error) { const { data: p2 } = await supabase!.from('profiles').select('*').eq('id', user.id).single(); return (p2 as Profile) ?? null }
    await supabase!.from('user_settings').insert({ user_id: user.id }).select().maybeSingle()
    return fresh
  }
  const db = loadDB()
  if (!db.sessionUserId) return null
  return db.profiles.find((p) => p.id === db.sessionUserId) ?? null
}

export async function signUp(email: string, password: string, username: string, displayName: string): Promise<void> {
  username = username.toLowerCase().trim().replace(/^@/, '')
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) err('Username: 3–24 chars, lowercase letters, digits, _ or .')
  if (password.length < 6) err('Password must be at least 6 characters.')
  if (isSrv()) {
    const { token } = await srv<{ token: string }>('/api/auth/register', { method: 'POST', auth: false, body: { email, password, username, displayName } })
    setServerToken(token)
    return
  }
  if (isSb()) {
    const { data: taken } = await supabase!.from('profiles').select('id').eq('username', username).maybeSingle()
    if (taken) err('That @username is already taken.')
    const { data, error } = await supabase!.auth.signUp({
      email, password,
      options: { data: { username, display_name: displayName } },
    })
    if (error) err(error.message)
    if (data.user && data.session) {
      await supabase!.from('profiles').upsert({
        id: data.user.id, username, display_name: displayName, is_online: true, last_seen: now(),
      })
    }
    return
  }
  const db = loadDB()
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) err('An account with this email already exists.')
  if (db.profiles.some((p) => p.username === username)) err('That @username is already taken.')
  const salt = uid()
  const id = uid()
  db.users.push({ id, email, passwordHash: await hashPassword(password, salt), salt })
  db.profiles.push({ id, username, display_name: displayName, avatar_url: '', bio: '', is_online: true, last_seen: now(), created_at: now() })
  db.sessionUserId = id
  saveDB(db)
}

export async function signIn(email: string, password: string): Promise<void> {
  if (isSrv()) {
    const { token } = await srv<{ token: string }>('/api/auth/login', { method: 'POST', auth: false, body: { email, password } })
    setServerToken(token)
    return
  }
  if (isSb()) {
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) err(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message)
    return
  }
  const db = loadDB()
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())
  if (!user) err('Invalid email or password.')
  const ok = user.id === 'demo_user' ? password === 'demo1234' : (await hashPassword(password, user.salt)) === user.passwordHash
  if (!ok) err('Invalid email or password.')
  db.sessionUserId = user.id
  const p = db.profiles.find((x) => x.id === user.id)
  if (p) { p.is_online = true; p.last_seen = now() }
  saveDB(db)
}

export async function signOutUser(): Promise<void> {
  if (isSrv()) {
    try { await disablePush() } catch { /* logout still proceeds */ }
    try { await srv('/api/auth/logout', { method: 'POST' }) } catch { /* token may already be gone */ }
    setServerToken(null)
    return
  }
  if (isSb()) {
    const p = await getCurrentProfile()
    if (p) await supabase!.from('profiles').update({ is_online: false, last_seen: now() }).eq('id', p.id)
    await supabase!.auth.signOut()
    return
  }
  const db = loadDB()
  const p = db.profiles.find((x) => x.id === db.sessionUserId)
  if (p) { p.is_online = false; p.last_seen = now() }
  db.sessionUserId = null
  saveDB(db)
}

export async function resetPassword(email: string): Promise<void> {
  if (isSrv()) err('Password reset by email is not available on this server yet. Ask the site admin to reset your password.')
  if (isSb()) {
    const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
    if (error) err(error.message)
    return
  }
  // Local demo cannot send email — be honest instead of faking success.
  err('Password reset emails require Supabase. In Local Demo Mode, create a new account or use demo@nexo.app / demo1234.')
}

export async function signInWithGoogle(): Promise<void> {
  if (isSrv()) err('Google sign-in is not configured on this server. Use email and password.')
  if (!isSb()) {
    err('Google sign-in is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, enable the Google provider in Supabase → Authentication → Providers, and add your redirect URL. See README → "Google OAuth setup".')
  }
  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) err(error.message)
}

export function onAuthChange(cb: () => void): () => void {
  if (isSrv()) {
    authListeners.add(cb)
    const onStorage = (e: StorageEvent) => { if (e.key === TOKEN_KEY) cb() }
    window.addEventListener('storage', onStorage)
    return () => { authListeners.delete(cb); window.removeEventListener('storage', onStorage) }
  }
  if (isSb()) {
    const { data } = supabase!.auth.onAuthStateChange(() => cb())
    return () => data.subscription.unsubscribe()
  }
  return onLocalChange(cb)
}

/* ============================== PROFILES ============================== */

export async function getProfile(id: string): Promise<Profile | null> {
  if (isSrv()) { try { return (await srv<{ profile: Profile }>(`/api/users/${id}`)).profile } catch { return null } }
  if (isSb()) { const { data } = await supabase!.from('profiles').select('*').eq('id', id).maybeSingle(); return (data as Profile) ?? null }
  return loadDB().profiles.find((p) => p.id === id) ?? null
}

export async function getProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const out: Record<string, Profile> = {}
  if (!ids.length) return out
  if (isSrv()) {
    const { profiles } = await srv<{ profiles: Profile[] }>(`/api/users?ids=${ids.join(',')}`)
    profiles.forEach((p) => { out[p.id] = p })
    return out
  }
  if (isSb()) {
    const { data } = await supabase!.from('profiles').select('*').in('id', ids)
    ;(data || []).forEach((p: Profile) => { out[p.id] = p })
    return out
  }
  const db = loadDB()
  db.profiles.forEach((p) => { if (ids.includes(p.id)) out[p.id] = p })
  return out
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  if (patch.username) {
    patch.username = patch.username.toLowerCase().trim().replace(/^@/, '')
    if (!/^[a-z0-9_.]{3,24}$/.test(patch.username)) err('Username: 3–24 chars, lowercase letters, digits, _ or .')
  }
  if (isSrv()) {
    await srv('/api/me', { method: 'PATCH', body: { username: patch.username, display_name: patch.display_name, bio: patch.bio, avatar_url: patch.avatar_url } })
    return
  }
  if (isSb()) {
    if (patch.username) {
      const { data: taken } = await supabase!.from('profiles').select('id').eq('username', patch.username).neq('id', id).maybeSingle()
      if (taken) err('That @username is already taken.')
    }
    const { error } = await supabase!.from('profiles').update(patch).eq('id', id)
    if (error) err(error.message.includes('duplicate') ? 'That @username is already taken.' : error.message)
    return
  }
  const db = loadDB()
  if (patch.username && db.profiles.some((p) => p.username === patch.username && p.id !== id)) err('That @username is already taken.')
  const p = db.profiles.find((x) => x.id === id)
  if (!p) err('Profile not found.')
  Object.assign(p, patch)
  saveDB(db)
}

export async function setPresence(id: string, online: boolean) {
  if (isSrv()) { try { await srv('/api/me/presence', { method: 'POST', body: { online } }) } catch { /* presence is best-effort */ } return }
  if (isSb()) { await supabase!.from('profiles').update({ is_online: online, last_seen: now() }).eq('id', id); return }
  const db = loadDB(); const p = db.profiles.find((x) => x.id === id)
  if (p) { p.is_online = online; p.last_seen = now(); saveDB(db) }
}

export async function searchUsers(rawQuery: string, excludeId: string, limit = 20): Promise<Profile[]> {
  // Users naturally type "@Maria": strip leading @ so it matches the stored
  // username (usernames are stored without @). Also strip ilike wildcards so
  // a query can never break the PostgREST .or() filter syntax.
  const q = rawQuery.trim().toLowerCase().replace(/^@+/, '').replace(/[%_,\\]/g, '')
  if (!q) return []
  if (isSrv()) return (await srv<{ users: Profile[] }>(`/api/users/search?q=${encodeURIComponent(q)}&limit=${limit}`)).users
  if (isSb()) {
    const { data, error } = await supabase!.from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_online, last_seen, created_at')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq('id', excludeId).limit(limit)
    if (error) err(error.message)
    return (data as Profile[]) || []
  }
  return loadDB().profiles.filter((p) => p.id !== excludeId && (p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))).slice(0, limit)
}

/* ============================== DIRECT CHATS ============================== */

export interface DirectListItem { conv: Conversation; other: Profile; lastMessage: Message | null; unread: number }

export async function listDirectChats(me: string): Promise<DirectListItem[]> {
  if (isSrv()) return (await srv<{ items: DirectListItem[] }>('/api/chats')).items
  if (isSb()) {
    const { data: cms } = await supabase!.from('conversation_members').select('*').eq('user_id', me)
    const convIds = (cms || []).map((c: { conversation_id: string }) => c.conversation_id)
    if (!convIds.length) return []
    const { data: convs } = await supabase!.from('conversations').select('*').in('id', convIds).order('last_message_at', { ascending: false })
    const items: DirectListItem[] = []
    for (const conv of (convs as Conversation[]) || []) {
      const { data: members } = await supabase!.from('conversation_members').select('*').eq('conversation_id', conv.id)
      const otherId = (members || []).find((m: { user_id: string }) => m.user_id !== me)?.user_id
      const other = otherId ? await getProfile(otherId) : null
      if (!other) continue
      const { data: msgs } = await supabase!.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1)
      const myMember = (members || []).find((m: { user_id: string }) => m.user_id === me)
      const { count } = await supabase!.from('messages').select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id).neq('sender_id', me).gt('created_at', myMember?.last_read_at || conv.created_at)
      items.push({ conv, other, lastMessage: ((msgs as Message[]) || [])[0] ?? null, unread: count || 0 })
    }
    return items.sort((a, b) => (b.conv.last_message_at || '').localeCompare(a.conv.last_message_at || ''))
  }
  const db = loadDB()
  const myConvs = db.convMembers.filter((m) => m.user_id === me).map((m) => m.conversation_id)
  return myConvs.map((cid) => {
    const conv = db.conversations.find((c) => c.id === cid)!
    const otherId = db.convMembers.find((m) => m.conversation_id === cid && m.user_id !== me)?.user_id
    const other = db.profiles.find((p) => p.id === otherId)!
    const msgs = db.messages.filter((m) => m.conversation_id === cid).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const mine = db.convMembers.find((m) => m.conversation_id === cid && m.user_id === me)!
    return { conv, other, lastMessage: msgs[msgs.length - 1] ?? null, unread: msgs.filter((m) => m.sender_id !== me && m.created_at > mine.last_read_at).length }
  }).sort((a, b) => b.conv.last_message_at.localeCompare(a.conv.last_message_at))
}

export async function getOrCreateDirect(me: string, otherId: string): Promise<string> {
  if (me === otherId) err('You cannot message yourself.')
  if (isSrv()) return (await srv<{ id: string }>('/api/chats/direct', { method: 'POST', body: { userId: otherId } })).id
  if (isSb()) {
    const mine = await listDirectChats(me)
    const existing = mine.find((i) => i.other.id === otherId)
    if (existing) return existing.conv.id
    const { data: conv, error } = await supabase!.from('conversations').insert({ created_by: me }).select().single()
    if (error) err(error.message)
    const { error: e2 } = await supabase!.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: me }, { conversation_id: conv.id, user_id: otherId },
    ])
    if (e2) err(e2.message)
    return conv.id as string
  }
  const db = loadDB()
  const existing = db.convMembers.filter((m) => m.user_id === me).map((m) => m.conversation_id)
    .find((cid) => db.convMembers.some((m) => m.conversation_id === cid && m.user_id === otherId))
  if (existing) return existing
  const conv: Conversation = { id: uid(), created_by: me, created_at: now(), last_message_at: now() }
  db.conversations.push(conv)
  db.convMembers.push(
    { conversation_id: conv.id, user_id: me, last_read_at: now(), joined_at: now() },
    { conversation_id: conv.id, user_id: otherId, last_read_at: now(), joined_at: now() },
  )
  saveDB(db)
  return conv.id
}

export interface PageOpts { limit?: number; before?: string }

/** Latest page of messages (ascending). Pass `before` (oldest created_at) to page backwards. */
export async function listMessages(conversationId: string, opts: PageOpts = {}): Promise<Message[]> {
  const limit = opts.limit ?? 60
  if (isSrv()) return (await srv<{ messages: Message[] }>(`/api/chats/${conversationId}/messages?limit=${limit}${opts.before ? `&before=${encodeURIComponent(opts.before)}` : ''}`)).messages
  if (isSb()) {
    let q = supabase!.from('messages').select('*').eq('conversation_id', conversationId)
    if (opts.before) q = q.lt('created_at', opts.before)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
    if (error) err(error.message)
    return ((data as Message[]) || []).reverse()
  }
  let all = loadDB().messages.filter((m) => m.conversation_id === conversationId)
  if (opts.before) all = all.filter((m) => m.created_at < opts.before!)
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit)
}

export async function sendMessage(conversationId: string, senderId: string, body: string, att?: AttachmentInfo, replyTo?: string): Promise<void> {
  body = body.trim()
  if (!body && !att) err('Message is empty.')
  if (isSrv()) { await srv(`/api/chats/${conversationId}/messages`, { method: 'POST', body: { body, attachment: att || null, replyTo: replyTo || '' } }); return }
  if (isSb()) {
    const { error } = await supabase!.from('messages').insert({
      conversation_id: conversationId, sender_id: senderId, body,
      attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '',
      attachment_duration: att?.duration || 0,
      // reply_to exists after migration 008; omit the field beforehand.
      ...(replyTo ? { reply_to: replyTo } : {}),
    })
    if (error) err(error.message)
    await supabase!.from('conversations').update({ last_message_at: now() }).eq('id', conversationId)
    return
  }
  const db = loadDB()
  db.messages.push({ id: uid(), conversation_id: conversationId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, reply_to: replyTo || '', edited_at: '', created_at: now() })
  const conv = db.conversations.find((c) => c.id === conversationId); if (conv) conv.last_message_at = now()
  saveDB(db)
  maybeAssistantReply(db, conversationId, senderId)
}

export async function markDirectRead(conversationId: string, userId: string) {
  if (isSrv()) { await srv(`/api/chats/${conversationId}/read`, { method: 'POST' }); return }
  if (isSb()) { await supabase!.from('conversation_members').update({ last_read_at: now() }).eq('conversation_id', conversationId).eq('user_id', userId); return }
  const db = loadDB(); const m = db.convMembers.find((x) => x.conversation_id === conversationId && x.user_id === userId)
  if (!m) return
  // Only write when something is actually unread — otherwise this write would
  // re-trigger realtime listeners and loop (load -> mark -> emit -> load...).
  const hasUnread = db.messages.some((x) => x.conversation_id === conversationId && x.sender_id !== userId && x.created_at > m.last_read_at)
  if (!hasUnread) return
  m.last_read_at = now(); saveDB(db)
}

/** Peer's last_read_at for read receipts (lightweight single-row lookup). */
export async function getPeerLastRead(conversationId: string, meId: string): Promise<string> {
  if (isSrv()) return (await srv<{ last_read_at: string }>(`/api/chats/${conversationId}/peer-read`)).last_read_at
  if (isSb()) {
    const { data } = await supabase!.from('conversation_members').select('user_id,last_read_at').eq('conversation_id', conversationId)
    return (data || []).find((m: { user_id: string }) => m.user_id !== meId)?.last_read_at || ''
  }
  const db = loadDB()
  return db.convMembers.find((m) => m.conversation_id === conversationId && m.user_id !== meId)?.last_read_at || ''
}

export async function getDirectPeer(conversationId: string, me: string): Promise<Profile | null> {
  if (isSrv()) return (await srv<{ profile: Profile | null }>(`/api/chats/${conversationId}/peer`)).profile
  if (isSb()) {
    const { data } = await supabase!.from('conversation_members').select('user_id').eq('conversation_id', conversationId)
    const otherId = (data || []).find((m: { user_id: string }) => m.user_id !== me)?.user_id
    return otherId ? getProfile(otherId) : null
  }
  const db = loadDB()
  const otherId = db.convMembers.find((m) => m.conversation_id === conversationId && m.user_id !== me)?.user_id
  return db.profiles.find((p) => p.id === otherId) ?? null
}

/* ============================== GROUPS ============================== */

export interface GroupListItem { group: Group; unread: number; lastMessage: GroupMessage | null; memberCount: number; myRole: string }

export async function listGroups(me: string): Promise<GroupListItem[]> {
  if (isSrv()) return (await srv<{ items: GroupListItem[] }>('/api/groups')).items
  if (isSb()) {
    const { data: gms } = await supabase!.from('group_members').select('*').eq('user_id', me)
    const items: GroupListItem[] = []
    for (const gm of gms || []) {
      const { data: g } = await supabase!.from('groups').select('*').eq('id', gm.group_id).single()
      if (!g) continue
      const { data: msgs } = await supabase!.from('group_messages').select('*').eq('group_id', g.id).order('created_at', { ascending: false }).limit(1)
      const { count: mc } = await supabase!.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', g.id)
      const { count: unread } = await supabase!.from('group_messages').select('*', { count: 'exact', head: true }).eq('group_id', g.id).neq('sender_id', me).gt('created_at', gm.last_read_at)
      items.push({ group: g as Group, unread: unread || 0, lastMessage: ((msgs as GroupMessage[]) || [])[0] ?? null, memberCount: mc || 0, myRole: gm.role })
    }
    return items.sort((a, b) => b.group.last_message_at.localeCompare(a.group.last_message_at))
  }
  const db = loadDB()
  return db.groupMembers.filter((m) => m.user_id === me).map((m) => {
    const group = db.groups.find((g) => g.id === m.group_id)!
    const msgs = db.groupMessages.filter((x) => x.group_id === group.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    return {
      group, myRole: m.role, memberCount: db.groupMembers.filter((x) => x.group_id === group.id).length,
      lastMessage: msgs[msgs.length - 1] ?? null,
      unread: msgs.filter((x) => x.sender_id !== me && x.created_at > m.last_read_at).length,
    }
  }).sort((a, b) => b.group.last_message_at.localeCompare(a.group.last_message_at))
}

export async function createGroup(me: string, name: string, description: string, isPublic: boolean, memberIds: string[]): Promise<string> {
  if (!name.trim()) err('Group name is required.')
  if (isSrv()) return (await srv<{ id: string }>('/api/groups', { method: 'POST', body: { name, description, isPublic, memberIds } })).id
  if (isSb()) {
    const { data: g, error } = await supabase!.from('groups').insert({ name: name.trim(), description, is_public: isPublic, owner_id: me }).select().single()
    if (error) err(error.message)
    const rows = [{ group_id: g.id, user_id: me, role: 'owner' }, ...memberIds.filter((x) => x !== me).map((user_id) => ({ group_id: g.id, user_id, role: 'member' }))]
    const { error: e2 } = await supabase!.from('group_members').insert(rows)
    if (e2) err(e2.message)
    return g.id as string
  }
  const db = loadDB()
  const group: Group = { id: uid(), name: name.trim(), avatar_url: '', description, owner_id: me, is_public: isPublic, created_at: now(), last_message_at: now() }
  db.groups.push(group)
  db.groupMembers.push({ group_id: group.id, user_id: me, role: 'owner', last_read_at: now(), joined_at: now() })
  memberIds.filter((x) => x !== me).forEach((user_id) => db.groupMembers.push({ group_id: group.id, user_id, role: 'member', last_read_at: now(), joined_at: now() }))
  saveDB(db)
  return group.id
}

export async function getGroup(id: string): Promise<Group | null> {
  if (isSrv()) { try { return (await srv<{ group: Group }>(`/api/groups/${id}`)).group } catch { return null } }
  if (isSb()) { const { data } = await supabase!.from('groups').select('*').eq('id', id).maybeSingle(); return (data as Group) ?? null }
  return loadDB().groups.find((g) => g.id === id) ?? null
}

export async function getGroupMembers(groupId: string): Promise<{ profile: Profile; role: string }[]> {
  if (isSrv()) return (await srv<{ members: { profile: Profile; role: string }[] }>(`/api/groups/${groupId}/members`)).members
  if (isSb()) {
    const { data } = await supabase!.from('group_members').select('*').eq('group_id', groupId)
    const map = await getProfiles((data || []).map((m: { user_id: string }) => m.user_id))
    return (data || []).map((m: { user_id: string; role: string }) => ({ profile: map[m.user_id], role: m.role })).filter((x: { profile?: Profile }) => x.profile)
  }
  const db = loadDB()
  return db.groupMembers.filter((m) => m.group_id === groupId).map((m) => ({ profile: db.profiles.find((p) => p.id === m.user_id)!, role: m.role })).filter((x) => x.profile)
}

export async function addGroupMember(groupId: string, userId: string) {
  if (isSrv()) { await srv(`/api/groups/${groupId}/members`, { method: 'POST', body: { userId } }); return }
  if (isSb()) { const { error } = await supabase!.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' }); if (error) err(error.message); return }
  const db = loadDB()
  if (!db.groupMembers.some((m) => m.group_id === groupId && m.user_id === userId))
    db.groupMembers.push({ group_id: groupId, user_id: userId, role: 'member', last_read_at: now(), joined_at: now() })
  saveDB(db)
}

export async function removeGroupMember(groupId: string, userId: string) {
  if (isSrv()) { await srv(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }); return }
  if (isSb()) { const { error } = await supabase!.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); db.groupMembers = db.groupMembers.filter((m) => !(m.group_id === groupId && m.user_id === userId)); saveDB(db)
}

export async function setGroupRole(groupId: string, userId: string, role: 'admin' | 'member') {
  if (isSrv()) { await srv(`/api/groups/${groupId}/members/${userId}/role`, { method: 'PATCH', body: { role } }); return }
  if (isSb()) { const { error } = await supabase!.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const m = db.groupMembers.find((x) => x.group_id === groupId && x.user_id === userId); if (m) m.role = role; saveDB(db)
}

export async function listGroupMessages(groupId: string, opts: PageOpts = {}): Promise<GroupMessage[]> {
  const limit = opts.limit ?? 60
  if (isSrv()) return (await srv<{ messages: GroupMessage[] }>(`/api/groups/${groupId}/messages?limit=${limit}${opts.before ? `&before=${encodeURIComponent(opts.before)}` : ''}`)).messages
  if (isSb()) {
    let q = supabase!.from('group_messages').select('*').eq('group_id', groupId)
    if (opts.before) q = q.lt('created_at', opts.before)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
    if (error) err(error.message)
    return ((data as GroupMessage[]) || []).reverse()
  }
  let all = loadDB().groupMessages.filter((m) => m.group_id === groupId)
  if (opts.before) all = all.filter((m) => m.created_at < opts.before!)
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit)
}

export async function sendGroupMessage(groupId: string, senderId: string, body: string, att?: AttachmentInfo, replyTo?: string) {
  body = body.trim(); if (!body && !att) err('Message is empty.')
  if (isSrv()) { await srv(`/api/groups/${groupId}/messages`, { method: 'POST', body: { body, attachment: att || null, replyTo: replyTo || '' } }); return }
  if (isSb()) {
    const { error } = await supabase!.from('group_messages').insert({ group_id: groupId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, ...(replyTo ? { reply_to: replyTo } : {}) })
    if (error) err(error.message)
    await supabase!.from('groups').update({ last_message_at: now() }).eq('id', groupId)
    return
  }
  const db = loadDB()
  db.groupMessages.push({ id: uid(), group_id: groupId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, reply_to: replyTo || '', edited_at: '', created_at: now() })
  const g = db.groups.find((x) => x.id === groupId); if (g) g.last_message_at = now()
  saveDB(db)
}

export async function markGroupRead(groupId: string, userId: string) {
  if (isSrv()) { await srv(`/api/groups/${groupId}/read`, { method: 'POST' }); return }
  if (isSb()) { await supabase!.from('group_members').update({ last_read_at: now() }).eq('group_id', groupId).eq('user_id', userId); return }
  const db = loadDB(); const m = db.groupMembers.find((x) => x.group_id === groupId && x.user_id === userId)
  if (!m) return
  const hasUnread = db.groupMessages.some((x) => x.group_id === groupId && x.sender_id !== userId && x.created_at > m.last_read_at)
  if (!hasUnread) return
  m.last_read_at = now(); saveDB(db)
}

/* ============================== PROFILE PUBLICATIONS ============================== */

/** Public (non-archived) posts of a profile, newest first. */
export async function listProfilePosts(userId: string): Promise<ProfilePost[]> {
  if (isSrv()) return (await srv<{ posts: ProfilePost[] }>(`/api/users/${userId}/posts`)).posts
  if (isSb()) {
    const { data, error } = await supabase!.from('profile_posts').select('*')
      .eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false }).limit(200)
    if (error) err(error.message)
    return (data as ProfilePost[]) || []
  }
  const db = loadDB()
  return db.profilePosts.filter((p) => p.user_id === userId && !p.archived)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}

export async function createPost(userId: string, body: string, att?: AttachmentInfo): Promise<ProfilePost> {
  body = body.trim()
  if (!body && !att) err('Post is empty.')
  if (isSrv()) {
    const { post } = await srv<{ post: ProfilePost }>('/api/posts', { method: 'POST', body: { body, attachment: att || null } })
    return post
  }
  if (isSb()) {
    const { data, error } = await supabase!.from('profile_posts').insert({
      user_id: userId, body,
      attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '',
    }).select().single()
    if (error) err(error.message)
    return data as ProfilePost
  }
  const db = loadDB()
  const post: ProfilePost = {
    id: uid(), user_id: userId, body,
    attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '',
    archived: false, created_at: now(),
  }
  db.profilePosts.push(post)
  saveDB(db)
  return post
}

export async function setPostArchived(postId: string, userId: string, archived: boolean): Promise<void> {
  if (isSrv()) { await srv(`/api/posts/${postId}`, { method: 'PATCH', body: { archived } }); return }
  if (isSb()) {
    const { error } = await supabase!.from('profile_posts').update({ archived }).eq('id', postId).eq('user_id', userId)
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  const post = db.profilePosts.find((p) => p.id === postId)
  if (!post) err('Post not found.')
  if (post!.user_id !== userId) err('Access denied.')
  post!.archived = archived
  saveDB(db)
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  if (isSrv()) { await srv(`/api/posts/${postId}`, { method: 'DELETE' }); return }
  if (isSb()) {
    const { error } = await supabase!.from('profile_posts').delete().eq('id', postId).eq('user_id', userId)
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  const post = db.profilePosts.find((p) => p.id === postId)
  if (!post) err('Post not found.')
  if (post!.user_id !== userId) err('Access denied.')
  db.profilePosts = db.profilePosts.filter((p) => p.id !== postId)
  saveDB(db)
}

/** Public gift showcase of any user: collectible NFTs + regular gifts. */
export async function listUserGifts(userId: string): Promise<UserGifts> {
  if (isSrv()) return srv<UserGifts>(`/api/users/${userId}/collectibles`)
  if (isSb()) {
    const { data, error } = await supabase!.rpc('profile_gifts', { p_user: userId })
    if (error) err(error.message)
    return data as UserGifts
  }
  const db = loadDB()
  const items = db.gifts.items.filter((i) => i.owner_id === userId)
    .map((item) => ({ item, model: giftModel(item.model_key), listing: localListingOf(db, item.id) }))
  const regular = Object.entries(db.gifts.regular[userId] || {})
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => ({ model: giftModel(key), qty }))
  return { items, regular }
}

/* ============================== MESSAGE EDIT / DELETE ============================== */

/** Edit own message text. Every backend re-checks authorship server-side. */
export async function editMessage(scope: ReactionScope, roomId: string, messageId: string, userId: string, body: string): Promise<void> {
  body = body.trim()
  if (!body) err('Message is empty.')
  if (isSrv()) {
    const path = scope === 'direct' ? `/api/chats/${roomId}/messages/${messageId}` : `/api/groups/${roomId}/messages/${messageId}`
    await srv(path, { method: 'PATCH', body: { body } })
    return
  }
  if (isSb()) {
    const table = scope === 'direct' ? 'messages' : 'group_messages'
    const { error } = await supabase!.from(table).update({ body, edited_at: now() }).eq('id', messageId).eq('sender_id', userId)
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  const list = scope === 'direct' ? db.messages : db.groupMessages
  const msg = list.find((x) => x.id === messageId)
  if (!msg) err('Message not found.')
  if (msg!.sender_id !== userId) err('Access denied.')
  msg!.body = body
  msg!.edited_at = now()
  saveDB(db)
}

/** Delete own message (its reactions go with it). Authorship is re-checked. */
export async function deleteMessage(scope: ReactionScope, roomId: string, messageId: string, userId: string): Promise<void> {
  if (isSrv()) {
    const path = scope === 'direct' ? `/api/chats/${roomId}/messages/${messageId}` : `/api/groups/${roomId}/messages/${messageId}`
    await srv(path, { method: 'DELETE' })
    return
  }
  if (isSb()) {
    const table = scope === 'direct' ? 'messages' : 'group_messages'
    const { error } = await supabase!.from(table).delete().eq('id', messageId).eq('sender_id', userId)
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  const list = scope === 'direct' ? db.messages : db.groupMessages
  const msg = list.find((x) => x.id === messageId)
  if (!msg) err('Message not found.')
  if (msg!.sender_id !== userId) err('Access denied.')
  if (scope === 'direct') db.messages = db.messages.filter((x) => x.id !== messageId)
  else db.groupMessages = db.groupMessages.filter((x) => x.id !== messageId)
  db.reactions = db.reactions.filter((r) => !(r.scope === scope && r.message_id === messageId))
  saveDB(db)
}

/* ============================== REACTIONS ============================== */

export async function listReactions(scope: ReactionScope, conversationId: string): Promise<Reaction[]> {
  if (isSrv()) return (await srv<{ reactions: Reaction[] }>(`/api/reactions?scope=${scope}&room=${conversationId}`)).reactions
  if (isSb()) {
    const { data, error } = await supabase!.from('message_reactions').select('*').eq('scope', scope).eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(1000)
    if (error) err(error.message)
    return (data as Reaction[]) || []
  }
  return loadDB().reactions.filter((r) => r.scope === scope && r.conversation_id === conversationId)
}

/** Add / change / remove (same emoji again) the user's single reaction to a message. */
export async function toggleReaction(scope: ReactionScope, conversationId: string, messageId: string, userId: string, emoji: string): Promise<void> {
  if (isSrv()) { await srv('/api/reactions/toggle', { method: 'POST', body: { scope, conversationId, messageId, emoji } }); return }
  if (isSb()) {
    const { data: existing } = await supabase!.from('message_reactions').select('*')
      .eq('message_id', messageId).eq('user_id', userId).maybeSingle()
    if (existing && existing.emoji === emoji) {
      const { error } = await supabase!.from('message_reactions').delete().eq('id', existing.id)
      if (error) err(error.message)
    } else if (existing) {
      const { error } = await supabase!.from('message_reactions').update({ emoji }).eq('id', existing.id)
      if (error) err(error.message)
    } else {
      const { error } = await supabase!.from('message_reactions').insert({ scope, conversation_id: conversationId, message_id: messageId, user_id: userId, emoji })
      if (error) err(error.message)
    }
    return
  }
  const db = loadDB()
  const idx = db.reactions.findIndex((r) => r.message_id === messageId && r.user_id === userId)
  if (idx >= 0 && db.reactions[idx].emoji === emoji) db.reactions.splice(idx, 1)
  else if (idx >= 0) db.reactions[idx].emoji = emoji
  else db.reactions.push({ id: uid(), scope, conversation_id: conversationId, message_id: messageId, user_id: userId, emoji, created_at: now() })
  saveDB(db)
}

export async function searchPublicGroups(q: string, limit = 20): Promise<Group[]> {
  q = q.trim().toLowerCase(); if (!q) return []
  if (isSrv()) return (await srv<{ groups: Group[] }>(`/api/groups/search?q=${encodeURIComponent(q)}`)).groups.slice(0, limit)
  if (isSb()) { const { data } = await supabase!.from('groups').select('*').eq('is_public', true).ilike('name', `%${q}%`).limit(limit); return (data as Group[]) || [] }
  return loadDB().groups.filter((g) => g.is_public && g.name.toLowerCase().includes(q)).slice(0, limit)
}

/* ============================== CHANNELS ============================== */

export interface ChannelListItem { channel: Channel; subscribers: number; myRole: string | null; canPost: boolean }

export async function listChannels(me: string): Promise<ChannelListItem[]> {
  if (isSrv()) return (await srv<{ items: ChannelListItem[] }>('/api/channels')).items
  if (isSb()) {
    const { data: cms } = await supabase!.from('channel_members').select('*').eq('user_id', me)
    const { data: pub } = await supabase!.from('channels').select('*').eq('is_public', true)
    const ids = new Set<string>([...(cms || []).map((c: { channel_id: string }) => c.channel_id), ...((pub as Channel[]) || []).map((c) => c.id)])
    const items: ChannelListItem[] = []
    for (const id of ids) {
      const ch = ((pub as Channel[]) || []).find((c) => c.id === id) || (await supabase!.from('channels').select('*').eq('id', id).single()).data
      if (!ch) continue
      const mine = (cms || []).find((c: { channel_id: string }) => c.channel_id === id)
      const { count } = await supabase!.from('channel_members').select('*', { count: 'exact', head: true }).eq('channel_id', id)
      items.push({ channel: ch as Channel, subscribers: count || 0, myRole: mine?.role ?? null, canPost: Boolean(mine && (mine.role !== 'subscriber' || mine.can_post)) || (ch as Channel).owner_id === me })
    }
    return items.sort((a, b) => Number(b.myRole !== null) - Number(a.myRole !== null))
  }
  const db = loadDB()
  return db.channels.filter((c) => c.is_public || db.channelMembers.some((m) => m.channel_id === c.id && m.user_id === me) || c.owner_id === me)
    .map((channel) => {
      const mine = db.channelMembers.find((m) => m.channel_id === channel.id && m.user_id === me)
      return {
        channel, subscribers: db.channelMembers.filter((m) => m.channel_id === channel.id).length,
        myRole: mine?.role ?? (channel.owner_id === me ? 'owner' : null),
        canPost: channel.owner_id === me || Boolean(mine && (mine.role !== 'subscriber' || mine.can_post)),
      }
    }).sort((a, b) => Number(b.myRole !== null) - Number(a.myRole !== null))
}

export async function createChannel(me: string, name: string, description: string, isPublic: boolean): Promise<string> {
  if (!name.trim()) err('Channel name is required.')
  if (isSrv()) return (await srv<{ id: string }>('/api/channels', { method: 'POST', body: { name, description, isPublic } })).id
  if (isSb()) {
    const { data: ch, error } = await supabase!.from('channels').insert({ name: name.trim(), description, is_public: isPublic, owner_id: me }).select().single()
    if (error) err(error.message)
    await supabase!.from('channel_members').insert({ channel_id: ch.id, user_id: me, role: 'owner', can_post: true })
    return ch.id as string
  }
  const db = loadDB()
  const ch: Channel = { id: uid(), name: name.trim(), avatar_url: '', description, owner_id: me, is_public: isPublic, created_at: now() }
  db.channels.push(ch)
  db.channelMembers.push({ channel_id: ch.id, user_id: me, role: 'owner', can_post: true, joined_at: now() })
  saveDB(db)
  return ch.id
}

export async function getChannel(id: string): Promise<Channel | null> {
  if (isSrv()) { try { return (await srv<{ channel: Channel }>(`/api/channels/${id}`)).channel } catch { return null } }
  if (isSb()) { const { data } = await supabase!.from('channels').select('*').eq('id', id).maybeSingle(); return (data as Channel) ?? null }
  return loadDB().channels.find((c) => c.id === id) ?? null
}

export async function subscribeChannel(channelId: string, userId: string) {
  if (isSrv()) { await srv(`/api/channels/${channelId}/subscribe`, { method: 'POST' }); return }
  if (isSb()) { const { error } = await supabase!.from('channel_members').insert({ channel_id: channelId, user_id: userId, role: 'subscriber', can_post: false }); if (error && !error.message.includes('duplicate')) err(error.message); return }
  const db = loadDB()
  if (!db.channelMembers.some((m) => m.channel_id === channelId && m.user_id === userId))
    db.channelMembers.push({ channel_id: channelId, user_id: userId, role: 'subscriber', can_post: false, joined_at: now() })
  saveDB(db)
}

export async function unsubscribeChannel(channelId: string, userId: string) {
  if (isSrv()) { await srv(`/api/channels/${channelId}/unsubscribe`, { method: 'POST' }); return }
  if (isSb()) { const { error } = await supabase!.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); db.channelMembers = db.channelMembers.filter((m) => !(m.channel_id === channelId && m.user_id === userId)); saveDB(db)
}

export async function getChannelMembers(channelId: string): Promise<{ profile: Profile; role: string; can_post: boolean }[]> {
  if (isSrv()) return (await srv<{ members: { profile: Profile; role: string; can_post: boolean }[] }>(`/api/channels/${channelId}/members`)).members
  if (isSb()) {
    const { data } = await supabase!.from('channel_members').select('*').eq('channel_id', channelId)
    const map = await getProfiles((data || []).map((m: { user_id: string }) => m.user_id))
    return (data || []).map((m: { user_id: string; role: string; can_post: boolean }) => ({ profile: map[m.user_id], role: m.role, can_post: m.can_post })).filter((x: { profile?: Profile }) => x.profile)
  }
  const db = loadDB()
  return db.channelMembers.filter((m) => m.channel_id === channelId).map((m) => ({ profile: db.profiles.find((p) => p.id === m.user_id)!, role: m.role, can_post: m.can_post })).filter((x) => x.profile)
}

export async function setChannelPoster(channelId: string, userId: string, canPost: boolean) {
  if (isSrv()) { await srv(`/api/channels/${channelId}/members/${userId}/poster`, { method: 'PATCH', body: { canPost } }); return }
  if (isSb()) { const { error } = await supabase!.from('channel_members').update({ can_post: canPost }).eq('channel_id', channelId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const m = db.channelMembers.find((x) => x.channel_id === channelId && x.user_id === userId); if (m) m.can_post = canPost; saveDB(db)
}

export async function listPosts(channelId: string): Promise<ChannelPost[]> {
  if (isSrv()) return (await srv<{ posts: ChannelPost[] }>(`/api/channels/${channelId}/posts`)).posts
  if (isSb()) {
    const { data, error } = await supabase!.from('channel_posts').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(300)
    if (error) err(error.message)
    return (data as ChannelPost[]) || []
  }
  return loadDB().posts.filter((p) => p.channel_id === channelId).sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function sendPost(channelId: string, authorId: string, body: string, att?: AttachmentInfo) {
  body = body.trim(); if (!body && !att) err('Post is empty.')
  if (isSrv()) { await srv(`/api/channels/${channelId}/posts`, { method: 'POST', body: { body, attachment: att || null } }); return }
  if (isSb()) {
    const { error } = await supabase!.from('channel_posts').insert({ channel_id: channelId, author_id: authorId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '' })
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  db.posts.push({ id: uid(), channel_id: channelId, author_id: authorId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', created_at: now() })
  saveDB(db)
}

export async function searchPublicChannels(q: string, limit = 20): Promise<Channel[]> {
  q = q.trim().toLowerCase(); if (!q) return []
  if (isSrv()) return (await srv<{ channels: Channel[] }>(`/api/channels/search?q=${encodeURIComponent(q)}`)).channels.slice(0, limit)
  if (isSb()) { const { data } = await supabase!.from('channels').select('*').eq('is_public', true).ilike('name', `%${q}%`).limit(limit); return (data as Channel[]) || [] }
  return loadDB().channels.filter((c) => c.is_public && c.name.toLowerCase().includes(q)).slice(0, limit)
}

/* ============================== UPLOADS ============================== */

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export function validateFile(file: File, localMode: boolean) {
  const isImage = IMAGE_TYPES.includes(file.type)
  const max = localMode ? 2.5 * 1024 * 1024 : 25 * 1024 * 1024
  if (file.size > max) err(`File is too large (max ${localMode ? '2.5 MB in Local Demo Mode' : '25 MB'}).`)
  return isImage
}

export async function uploadFile(file: File, userId: string): Promise<AttachmentInfo> {
  if (isSrv()) {
    validateFile(file, false)
    const data = await fileToBase64(file)
    const up = await srv<{ url: string }>('/api/upload', { method: 'POST', body: { name: file.name, type: file.type, data } })
    return { url: up.url, name: file.name, type: file.type }
  }
  const isImage = validateFile(file, !isSb())
  if (isSb()) {
    const bucket = isImage && file.name.match(/\.(png|jpe?g|gif|webp)$/i) && file.size < 5 * 1024 * 1024 ? 'attachments' : 'attachments'
    const path = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase!.storage.from(bucket).upload(path, file, { upsert: false })
    if (error) err(`Upload failed: ${error.message}`)
    const { data } = supabase!.storage.from(bucket).getPublicUrl(path)
    // Private bucket: fall back to signed URL for 7 days
    const { data: signed } = await supabase!.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7)
    return { url: signed?.signedUrl || data.publicUrl, name: file.name, type: file.type }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file)
  })
  return { url: dataUrl, name: file.name, type: file.type }
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  if (isSrv()) {
    if (!IMAGE_TYPES.includes(file.type)) err('Avatar must be a PNG, JPG, GIF or WebP image.')
    if (file.size > 5 * 1024 * 1024) err('Avatar image is too large.')
    const data = await fileToBase64(file)
    return (await srv<{ url: string }>('/api/avatar', { method: 'POST', body: { name: file.name, type: file.type, data } })).url
  }
  if (!IMAGE_TYPES.includes(file.type)) err('Avatar must be a PNG, JPG, GIF or WebP image.')
  if (file.size > (isSb() ? 5 : 2.5) * 1024 * 1024) err('Avatar image is too large.')
  if (isSb()) {
    const path = `${userId}/avatar_${Date.now()}`
    const { error } = await supabase!.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) err(`Avatar upload failed: ${error.message}`)
    return supabase!.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file)
  })
}

/* ============================== SETTINGS ============================== */

export async function getSettings(userId: string): Promise<UserSettings> {
  if (isSrv()) return (await srv<{ settings: UserSettings }>('/api/settings')).settings
  if (isSb()) {
    const { data } = await supabase!.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    if (data) return data as UserSettings
    const fresh: UserSettings = { user_id: userId, theme: 'nexoglass', notifications_enabled: true, privacy_profile: 'public', updated_at: now() }
    await supabase!.from('user_settings').insert(fresh)
    return fresh
  }
  const db = loadDB()
  let s = db.settings.find((x) => x.user_id === userId)
  if (!s) { s = { user_id: userId, theme: 'nexoglass', notifications_enabled: true, privacy_profile: 'public', updated_at: now() }; db.settings.push(s); saveDB(db) }
  return s
}

export async function updateSettings(userId: string, patch: Partial<UserSettings>) {
  if (isSrv()) { await srv('/api/settings', { method: 'PUT', body: patch }); return }
  if (isSb()) { const { error } = await supabase!.from('user_settings').update({ ...patch, updated_at: now() }).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const s = db.settings.find((x) => x.user_id === userId)
  if (s) Object.assign(s, patch, { updated_at: now() }); saveDB(db)
}

/* ============================== REALTIME ============================== */

/* ---- own-server WebSocket hub (rooms + global + typing) ---- */
let wsSock: WebSocket | null = null
let wsReconnect: number | undefined
const wsRoomCbs = new Map<string, Set<() => void>>()
const wsTypingCbs = new Map<string, Set<{ meId: string; cb: (name: string) => void }>>()

function wsUrl(): string {
  const tok = encodeURIComponent(getServerToken() || '')
  if (apiBase) return `${apiBase.replace(/^http/, 'ws')}/ws?token=${tok}`
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws?token=${tok}`
}
function wsSendSub(key: string) {
  if (!wsSock || wsSock.readyState !== WebSocket.OPEN || key === 'global') return
  const [kind, id] = key.split(/:(.+)/)
  try { wsSock.send(JSON.stringify({ t: 'sub', kind, id })) } catch { /* noop */ }
}
function ensureWs() {
  if (!isSrv() || wsSock || typeof window === 'undefined') return
  if (!wsRoomCbs.size && !wsTypingCbs.size) return
  try { wsSock = new WebSocket(wsUrl()) } catch { wsSock = null; return }
  wsSock.onopen = () => { wsRoomCbs.forEach((_, key) => wsSendSub(key)) }
  wsSock.onmessage = (e) => {
    try {
      const m = JSON.parse(String(e.data)) as { t: string; kind?: string; id?: string; scope?: string; userId?: string; name?: string }
      if (m.t === 'changed') {
        wsRoomCbs.get('global')?.forEach((cb) => cb())
        if (m.kind && m.id) wsRoomCbs.get(`${m.kind}:${m.id}`)?.forEach((cb) => cb())
      } else if (m.t === 'typing' && m.scope) {
        wsTypingCbs.get(m.scope)?.forEach(({ meId, cb }) => { if (m.userId !== meId) cb(m.name || '') })
      }
    } catch { /* ignore malformed frames */ }
  }
  wsSock.onclose = () => {
    wsSock = null
    if ((wsRoomCbs.size || wsTypingCbs.size) && getServerToken()) {
      window.clearTimeout(wsReconnect)
      wsReconnect = window.setTimeout(() => ensureWs(), 2000)
    }
  }
  wsSock.onerror = () => { try { wsSock?.close() } catch { /* noop */ } }
}
function wsSubRoom(key: string, cb: () => void): () => void {
  if (!wsRoomCbs.has(key)) wsRoomCbs.set(key, new Set())
  wsRoomCbs.get(key)!.add(cb)
  ensureWs(); wsSendSub(key)
  return () => {
    wsRoomCbs.get(key)?.delete(cb)
    if (wsRoomCbs.get(key)?.size === 0) wsRoomCbs.delete(key)
  }
}

/** Subscribe to any relevant data change. Local: storage/broadcast. Supabase: postgres changes. Server: WebSocket. */
export function subscribeRoom(kind: 'direct' | 'group' | 'channel', id: string, cb: () => void): () => void {
  if (isSrv()) return wsSubRoom(`${kind}:${id}`, cb)
  if (isSb()) {
    const table = kind === 'direct' ? 'messages' : kind === 'group' ? 'group_messages' : 'channel_posts'
    const col = kind === 'direct' ? 'conversation_id' : kind === 'group' ? 'group_id' : 'channel_id'
    const ch = supabase!.channel(`room-${kind}-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `${col}=eq.${id}` }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `conversation_id=eq.${id}` }, () => cb())
      .subscribe()
    return () => { supabase!.removeChannel(ch) }
  }
  return onLocalChange(cb)
}

export function subscribeGlobal(cb: () => void): () => void {
  if (isSrv()) return wsSubRoom('global', cb)
  if (isSb()) {
    const ch = supabase!.channel('nexo-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages' }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_posts' }, () => cb())
      .subscribe()
    return () => { supabase!.removeChannel(ch) }
  }
  return onLocalChange(cb)
}

/* Typing indicators (throttled by the caller) */
let typingBc: BroadcastChannel | null = null
try { typingBc = new BroadcastChannel('nexo_typing') } catch { typingBc = null }

export function sendTyping(scope: string, from: Profile) {
  if (isSrv()) {
    ensureWs()
    if (wsSock && wsSock.readyState === WebSocket.OPEN) {
      try { wsSock.send(JSON.stringify({ t: 'typing', scope, name: from.display_name })) } catch { /* noop */ }
    }
    return
  }
  if (isSb()) {
    const ch = supabase!.channel(`typing-${scope}`)
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') { ch.send({ type: 'broadcast', event: 'typing', payload: { userId: from.id, name: from.display_name, at: Date.now() } }) } })
    setTimeout(() => { supabase!.removeChannel(ch) }, 1200)
    return
  }
  try { typingBc?.postMessage({ scope, userId: from.id, name: from.display_name, at: Date.now() }) } catch { /* noop */ }
}

export function subscribeTyping(scope: string, meId: string, cb: (name: string) => void): () => void {
  if (isSrv()) {
    if (!wsTypingCbs.has(scope)) wsTypingCbs.set(scope, new Set())
    const entry = { meId, cb }
    wsTypingCbs.get(scope)!.add(entry)
    ensureWs()
    return () => {
      wsTypingCbs.get(scope)?.delete(entry)
      if (wsTypingCbs.get(scope)?.size === 0) wsTypingCbs.delete(scope)
    }
  }
  if (isSb()) {
    const ch = supabase!.channel(`typing-${scope}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== meId) cb(payload.name as string)
      }).subscribe()
    return () => { supabase!.removeChannel(ch) }
  }
  if (!typingBc) return () => undefined
  const handler = (e: MessageEvent) => {
    const d = e.data as { scope: string; userId: string; name: string }
    if (d.scope === scope && d.userId !== meId) cb(d.name)
  }
  typingBc.addEventListener('message', handler)
  return () => typingBc!.removeEventListener('message', handler)
}


/* ============================== GIFTS / NEX ============================== */
// NEX is a virtual in-app currency (no real-world value). Every balance or
// ownership change is executed by the backend (server / Supabase RPC /
// local store) — the frontend only ever sends an item id and, for listings,
// the asking price the owner typed.

function localGiftWallet(db: LocalDB, userId: string) {
  let w = db.gifts.wallets[userId]
  if (!w) {
    w = { balance: GIFT_WELCOME_BONUS, last_bonus_at: '' }
    db.gifts.wallets[userId] = w
    db.gifts.txns.push({ id: uid(), user_id: userId, kind: 'welcome', amount: GIFT_WELCOME_BONUS, note: 'Welcome bonus', created_at: now() })
  }
  return w
}
const localListingOf = (db: LocalDB, itemId: string) => db.gifts.listings.find((l) => l.item_id === itemId) ?? null

function localGiftState(db: LocalDB, me: string): GiftState {
  const w = localGiftWallet(db, me)
  const bonusReadyAt = w.last_bonus_at ? new Date(w.last_bonus_at).getTime() + GIFT_BONUS_INTERVAL_MS : 0
  return {
    balance: w.balance,
    nextBonusAt: bonusReadyAt > Date.now() ? new Date(bonusReadyAt).toISOString() : null,
    bonusAmount: GIFT_DAILY_BONUS,
    myItems: db.gifts.items.filter((i) => i.owner_id === me)
      .map((item) => ({ item, model: { ...giftModel(item.model_key), issued: db.gifts.items.filter((x) => x.model_key === item.model_key).length }, listing: localListingOf(db, item.id) })),
    myRegular: Object.entries(db.gifts.regular[me] || {}).filter(([, q]) => q > 0)
      .map(([key, qty]) => ({ model: giftModel(key), qty })),
    transactions: db.gifts.txns.filter((t) => t.user_id === me).slice(-30).reverse()
      .map(({ id, kind, amount, note, created_at }) => ({ id, kind, amount, note, created_at })),
  }
}

function localMe(db: LocalDB): string {
  if (!db.sessionUserId) err('Session expired. Please sign in again.')
  return db.sessionUserId!
}

export async function getGiftState(): Promise<GiftState> {
  if (isSrv()) return srv<GiftState>('/api/gifts/state')
  if (isSb()) {
    const { data, error } = await supabase!.rpc('gifts_state')
    if (error) err(error.message)
    return data as GiftState
  }
  const db = loadDB()
  const state = localGiftState(db, localMe(db))
  saveDB(db)
  return state
}

export async function getGiftMarket(): Promise<MarketEntry[]> {
  if (isSrv()) return (await srv<{ entries: MarketEntry[] }>('/api/gifts/market')).entries
  if (isSb()) {
    const { data, error } = await supabase!.rpc('gifts_market')
    if (error) err(error.message)
    return (data as { entries: MarketEntry[] }).entries
  }
  const db = loadDB()
  const entries: MarketEntry[] = []
  for (const item of db.gifts.items) {
    const model = { ...giftModel(item.model_key), issued: db.gifts.items.filter((x) => x.model_key === item.model_key).length }
    const listing = localListingOf(db, item.id)
    if (listing) entries.push({ item, model, listing, seller: db.profiles.find((p) => p.id === listing.seller_id) ?? null, price: listing.price })
    else if (item.owner_id === null) entries.push({ item, model, listing: null, seller: null, price: model.floor_price })
  }
  return entries
}

export async function buyGift(itemId: string): Promise<{ balance: number }> {
  if (isSrv()) return srv<{ balance: number }>('/api/gifts/buy', { method: 'POST', body: { itemId } })
  if (isSb()) {
    const { data, error } = await supabase!.rpc('buy_gift', { p_item: itemId })
    if (error) err(error.message)
    return data as { balance: number }
  }
  const db = loadDB()
  const me = localMe(db)
  const item = db.gifts.items.find((i) => i.id === itemId)
  if (!item) err('Gift not found.')
  const model = giftModel(item!.model_key)
  const listing = localListingOf(db, item!.id)
  if (item!.owner_id === me) err('This gift is already yours.')
  if (!listing && item!.owner_id !== null) err('This gift is not for sale.')
  const price = listing ? listing.price : model.floor_price
  const w = localGiftWallet(db, me)
  if (w.balance < price) err('Not enough NEX.')
  w.balance -= price
  if (listing) {
    localGiftWallet(db, listing.seller_id).balance += price
    db.gifts.txns.push({ id: uid(), user_id: listing.seller_id, kind: 'sale', amount: price, note: `${model.name} #${item!.serial}`, created_at: now() })
    db.gifts.listings = db.gifts.listings.filter((l) => l.id !== listing.id)
  }
  item!.owner_id = me
  db.profiles.forEach((p) => {
    if (p.worn_gift?.item_id === item!.id && p.id !== me) p.worn_gift = null
    if (p.id !== me && p.bg_gifts?.some((g) => g.item_id === item!.id)) p.bg_gifts = p.bg_gifts.filter((g) => g.item_id !== item!.id)
  })
  db.gifts.txns.push({ id: uid(), user_id: me, kind: 'purchase', amount: -price, note: `${model.name} #${item!.serial}`, created_at: now() })
  saveDB(db)
  return { balance: w.balance }
}

export async function listGift(itemId: string, price: number): Promise<GiftListing> {
  if (!Number.isInteger(price) || price <= 0 || price > 1000000000) err('Price must be a positive whole number.')
  if (isSrv()) return (await srv<{ listing: GiftListing }>('/api/gifts/list', { method: 'POST', body: { itemId, price } })).listing
  if (isSb()) {
    const { data, error } = await supabase!.rpc('list_gift', { p_item: itemId, p_price: price })
    if (error) err(error.message)
    return (data as { listing: GiftListing }).listing
  }
  const db = loadDB()
  const me = localMe(db)
  const item = db.gifts.items.find((i) => i.id === itemId)
  if (!item) err('Gift not found.')
  if (item!.owner_id !== me) err('You do not own this gift.')
  if (localListingOf(db, itemId)) err('This gift is already listed.')
  const listing: GiftListing = { id: uid(), item_id: itemId, seller_id: me, price, created_at: now() }
  db.gifts.listings.push(listing)
  saveDB(db)
  return listing
}

export async function unlistGift(listingId: string): Promise<void> {
  if (isSrv()) { await srv('/api/gifts/unlist', { method: 'POST', body: { listingId } }); return }
  if (isSb()) {
    const { error } = await supabase!.rpc('unlist_gift', { p_listing: listingId })
    if (error) err(error.message)
    return
  }
  const db = loadDB()
  const me = localMe(db)
  const listing = db.gifts.listings.find((l) => l.id === listingId)
  if (!listing) err('Listing not found.')
  if (listing!.seller_id !== me) err('Access denied.')
  db.gifts.listings = db.gifts.listings.filter((l) => l.id !== listingId)
  saveDB(db)
}

export async function buyRegularGift(giftKey: string): Promise<{ balance: number }> {
  if (isSrv()) return srv<{ balance: number }>('/api/gifts/buy-regular', { method: 'POST', body: { giftKey } })
  if (isSb()) {
    const { data, error } = await supabase!.rpc('buy_regular', { p_key: giftKey })
    if (error) err(error.message)
    return data as { balance: number }
  }
  const db = loadDB()
  const me = localMe(db)
  const model = giftModel(giftKey)
  if (model.kind !== 'regular') err('Gift not found.')
  const w = localGiftWallet(db, me)
  if (w.balance < model.floor_price) err('Not enough NEX.')
  w.balance -= model.floor_price
  if (!db.gifts.regular[me]) db.gifts.regular[me] = {}
  db.gifts.regular[me][giftKey] = (db.gifts.regular[me][giftKey] || 0) + 1
  db.gifts.txns.push({ id: uid(), user_id: me, kind: 'regular_buy', amount: -model.floor_price, note: model.name, created_at: now() })
  saveDB(db)
  return { balance: w.balance }
}

/** Send an owned regular gift into a direct chat (gift message attachment). */
/** Sell one regular gift back to the store: price minus the flat fee. */
export async function sellRegularGift(giftKey: string): Promise<{ balance: number; credit: number; qty: number }> {
  const model = giftModel(giftKey)
  if (isSrv()) return srv('/api/gifts/sell-regular', { method: 'POST', body: { giftKey } })
  const me = (await getCurrentProfile())?.id
  if (!me) err('Session expired. Please sign in again.')
  if (isSb()) {
    const { data, error } = await supabase!.rpc('sell_regular', { p_key: giftKey })
    if (error) err(error.message)
    return data as { balance: number; credit: number; qty: number }
  }
  const db = loadDB()
  const inv = db.gifts.regular[me!] || {}
  if ((inv[giftKey] || 0) < 1) err('No gifts left to sell.')
  const credit = model.floor_price - GIFT_SELL_FEE
  if (credit <= 0) err('This gift cannot be sold.')
  inv[giftKey] -= 1
  db.gifts.regular[me!] = inv
  const w = localGiftWallet(db, me!)
  w.balance += credit
  db.gifts.txns.push({ id: uid(), user_id: me!, kind: 'regular_sell', amount: credit, note: model.name, created_at: now() })
  saveDB(db)
  return { balance: w.balance, credit, qty: inv[giftKey] }
}

/** Transfer a collectible to another user; the sender pays the flat fee. */
export async function transferGift(itemId: string, toUserId: string): Promise<{ balance: number }> {
  if (isSrv()) return srv('/api/gifts/transfer', { method: 'POST', body: { itemId, toUserId } })
  const me = (await getCurrentProfile())?.id
  if (!me) err('Session expired. Please sign in again.')
  if (isSb()) {
    const { data, error } = await supabase!.rpc('transfer_gift', { p_item: itemId, p_to: toUserId })
    if (error) err(error.message)
    return data as { balance: number }
  }
  const db = loadDB()
  const item = db.gifts.items.find((i) => i.id === itemId)
  if (!item) err('Gift not found.')
  if (item!.owner_id !== me) err('You do not own this gift.')
  const to = db.profiles.find((p) => p.id === toUserId)
  if (!to) err('Profile not found.')
  if (toUserId === me) err('You cannot transfer to yourself.')
  const w = localGiftWallet(db, me!)
  if (w.balance < GIFT_TRANSFER_FEE) err('Not enough NEX.')
  const model = giftModel(item!.model_key)
  const from = db.profiles.find((p) => p.id === me!)
  w.balance -= GIFT_TRANSFER_FEE
  db.gifts.listings = db.gifts.listings.filter((l) => l.item_id !== itemId)
  item!.owner_id = toUserId
  db.profiles.forEach((p) => {
    if (p.worn_gift?.item_id === itemId && p.id !== toUserId) p.worn_gift = null
    if (p.id !== toUserId && p.bg_gifts?.some((g) => g.item_id === itemId)) p.bg_gifts = p.bg_gifts.filter((g) => g.item_id !== itemId)
  })
  db.gifts.txns.push({ id: uid(), user_id: me!, kind: 'transfer', amount: -GIFT_TRANSFER_FEE, note: `${model.name} #${item!.serial} → @${to!.username}`, created_at: now() })
  db.gifts.txns.push({ id: uid(), user_id: toUserId, kind: 'transfer', amount: 0, note: `${model.name} #${item!.serial} ← @${from?.username ?? ''}`, created_at: now() })
  saveDB(db)
  return { balance: w.balance }
}

export async function sendRegularGift(giftKey: string, toUserId: string): Promise<string> {
  const model = giftModel(giftKey)
  if (isSrv()) return (await srv<{ conversationId: string }>('/api/gifts/send-regular', { method: 'POST', body: { giftKey, toUserId } })).conversationId
  const me = (await getCurrentProfile())?.id
  if (!me) err('Session expired. Please sign in again.')
  if (isSb()) {
    const { error } = await supabase!.rpc('send_regular', { p_key: giftKey, p_to: toUserId })
    if (error) err(error.message)
  } else {
    const db = loadDB()
    const inv = db.gifts.regular[me!] || {}
    if ((inv[giftKey] || 0) < 1) err('No gifts left to send.')
    inv[giftKey] -= 1
    db.gifts.regular[me!] = inv
    // The recipient receives the gift into their own inventory/showcase.
    if (!db.gifts.regular[toUserId]) db.gifts.regular[toUserId] = {}
    db.gifts.regular[toUserId][giftKey] = (db.gifts.regular[toUserId][giftKey] || 0) + 1
    const to = db.profiles.find((p) => p.id === toUserId)
    const from = db.profiles.find((p) => p.id === me!)
    db.gifts.txns.push({ id: uid(), user_id: me!, kind: 'regular_send', amount: 0, note: `${model.name} → @${to?.username ?? ''}`, created_at: now() })
    db.gifts.txns.push({ id: uid(), user_id: toUserId, kind: 'regular_send', amount: 0, note: `${model.name} ← @${from?.username ?? ''}`, created_at: now() })
    saveDB(db)
  }
  const convId = await getOrCreateDirect(me!, toUserId)
  await sendMessage(convId, me!, model.name, { url: giftKey, name: model.name, type: 'gift/nexo' })
  return convId
}

/** Redeem a one-time promo code for NEX. The backend decides everything —
 *  the frontend only sends the typed code. */
export async function redeemPromoCode(code: string): Promise<{ amount: number; balance: number }> {
  if (!normalizePromoCode(code)) err('Invalid code.')
  if (isSrv()) return srv<{ amount: number; balance: number }>('/api/gifts/redeem', { method: 'POST', body: { code } })
  if (isSb()) {
    const { data, error } = await supabase!.rpc('redeem_promo', { p_code: code })
    if (error) err(error.message)
    return data as { amount: number; balance: number }
  }
  const db = loadDB()
  const me = localMe(db)
  const norm = normalizePromoCode(code)
  const entry = db.gifts.promo.find((x) => normalizePromoCode(x.code) === norm)
  if (!entry) err('Invalid code.')
  if (entry!.redeemed_by) err('This code has already been used.')
  const w = localGiftWallet(db, me)
  w.balance += entry!.amount
  entry!.redeemed_by = me
  entry!.redeemed_at = now()
  db.gifts.txns.push({ id: uid(), user_id: me, kind: 'promo', amount: entry!.amount, note: 'Promo code', created_at: now() })
  saveDB(db)
  return { amount: entry!.amount, balance: w.balance }
}

/* ============================== NEXO PREMIUM ============================== */
// Premium costs 100 ₽ / 30 days and is activated with a one-time code
// (there is no card gateway in the app). The backend decides everything.

export async function getPremiumState(): Promise<PremiumState> {
  if (isSrv()) return srv<PremiumState>('/api/premium/me')
  const me = await getCurrentProfile()
  const until = me?.premium_until ?? null
  return { active: isPremiumActive(me), until, priceRub: PREMIUM_PRICE_RUB, days: PREMIUM_DAYS }
}

/** Activate/extend Premium by 30 days with a one-time code. Codes stack. */
export async function redeemPremiumCode(code: string): Promise<{ until: string; days: number }> {
  if (!normalizePremiumCode(code)) err('Invalid code.')
  if (isSrv()) return srv<{ until: string; days: number }>('/api/premium/redeem', { method: 'POST', body: { code } })
  if (isSb()) {
    const { data, error } = await supabase!.rpc('redeem_premium_code', { p_code: code })
    if (error) err(error.message)
    return data as { until: string; days: number }
  }
  const db = loadDB()
  const me = localMe(db)
  const norm = normalizePremiumCode(code)
  const entry = db.premium.codes.find((x) => normalizePremiumCode(x.code) === norm)
  if (!entry) err('Invalid code.')
  if (entry!.redeemed_by) err('This code has already been used.')
  const profile = db.profiles.find((p) => p.id === me)
  if (!profile) err('Profile not found.')
  const base = Math.max(Date.now(), profile!.premium_until ? new Date(profile!.premium_until).getTime() : 0)
  const until = new Date(base + entry!.days * 24 * 60 * 60 * 1000).toISOString()
  profile!.premium_until = until
  entry!.redeemed_by = me
  entry!.redeemed_at = now()
  saveDB(db)
  return { until, days: entry!.days }
}

export interface PremiumDecorPatch {
  emojiStatus?: string | null
  wornItemId?: string | null
  nameColor?: string
  business?: BusinessInfo | null
  /** Item ids to pin to the profile background (max 8); null/[] clears. */
  bgGiftItemIds?: string[] | null
  music?: ProfileMusic | null
  font?: string
  profileTheme?: string
}

function assertPremiumDecor(patch: PremiumDecorPatch) {
  if (patch.emojiStatus != null && patch.emojiStatus !== '' && !EMOJI_STATUSES.includes(patch.emojiStatus)) err('Invalid code.')
  if (patch.nameColor !== undefined && patch.nameColor !== '' && !NAME_COLORS.some((c) => c.key === patch.nameColor)) err('Invalid code.')
  if (patch.font !== undefined && !(PROFILE_FONTS as readonly string[]).includes(patch.font)) err('Invalid code.')
  if (patch.profileTheme !== undefined && !(PROFILE_THEMES as readonly string[]).includes(patch.profileTheme)) err('Invalid code.')
  if (patch.bgGiftItemIds != null && patch.bgGiftItemIds.length > 8) err('Invalid code.')
}

/** Save Premium decorations (status emoji, worn NFT, name colour, business).
 *  Setting any of them requires an active Premium — enforced by the backend. */
export async function updatePremiumDecor(patch: PremiumDecorPatch): Promise<Profile> {
  assertPremiumDecor(patch)
  if (isSrv()) return (await srv<{ profile: Profile }>('/api/premium/decor', { method: 'PUT', body: patch })).profile
  const me = await getCurrentProfile()
  if (!me) err('Session expired. Please sign in again.')
  const wantsPremium = Boolean(patch.emojiStatus) || Boolean(patch.wornItemId) || Boolean(patch.nameColor) || Boolean(patch.business?.enabled)
    || Boolean(patch.bgGiftItemIds?.length) || Boolean(patch.music?.url)
    || (patch.font !== undefined && patch.font !== 'default') || (patch.profileTheme !== undefined && patch.profileTheme !== 'default')
  if (wantsPremium && !isPremiumActive(me)) err('NEXO Premium required.')
  let worn = me!.worn_gift ?? null
  if (patch.wornItemId !== undefined) {
    if (!patch.wornItemId) worn = null
    else {
      const state = await getGiftState()
      const owned = state.myItems.find((x) => x.item.id === patch.wornItemId)
      if (!owned) err('You do not own this gift.')
      worn = { item_id: owned!.item.id, model_key: owned!.item.model_key, serial: owned!.item.serial }
    }
  }
  let bgGifts: BgGift[] | undefined
  if (patch.bgGiftItemIds !== undefined) {
    bgGifts = []
    if (patch.bgGiftItemIds?.length) {
      const state = await getGiftState()
      for (const itemId of patch.bgGiftItemIds) {
        const owned = state.myItems.find((x) => x.item.id === itemId)
        if (!owned) err('You do not own this gift.')
        bgGifts.push({ item_id: owned!.item.id, model_key: owned!.item.model_key, serial: owned!.item.serial })
      }
    }
  }
  const next: Partial<Profile> = {}
  if (patch.emojiStatus !== undefined) next.emoji_status = patch.emojiStatus || ''
  if (patch.wornItemId !== undefined) next.worn_gift = worn
  if (patch.nameColor !== undefined) next.name_color = patch.nameColor || ''
  if (patch.business !== undefined) next.business = patch.business ? sanitizeBusiness(patch.business) : null
  if (bgGifts !== undefined) next.bg_gifts = bgGifts
  if (patch.music !== undefined) {
    next.profile_music = patch.music?.url
      ? { title: String(patch.music.title || '').slice(0, 80), artist: String(patch.music.artist || '').slice(0, 80), url: String(patch.music.url).slice(0, 2000) }
      : null
  }
  if (patch.font !== undefined) next.profile_font = patch.font
  if (patch.profileTheme !== undefined) next.profile_theme = patch.profileTheme
  if (isSb()) {
    const { error } = await supabase!.from('profiles').update(next).eq('id', me!.id)
    if (error) err(error.message)
  } else {
    const db = loadDB()
    const p = db.profiles.find((x) => x.id === me!.id)
    if (!p) err('Profile not found.')
    Object.assign(p!, next)
    saveDB(db)
  }
  return { ...me!, ...next }
}

export async function claimGiftBonus(): Promise<{ balance: number }> {
  if (isSrv()) return srv<{ balance: number }>('/api/gifts/claim-bonus', { method: 'POST' })
  if (isSb()) {
    const { data, error } = await supabase!.rpc('claim_bonus')
    if (error) err(error.message)
    return data as { balance: number }
  }
  const db = loadDB()
  const me = localMe(db)
  const w = localGiftWallet(db, me)
  if (w.last_bonus_at && Date.now() - new Date(w.last_bonus_at).getTime() < GIFT_BONUS_INTERVAL_MS) err('Daily bonus is not ready yet.')
  w.balance += GIFT_DAILY_BONUS
  w.last_bonus_at = now()
  db.gifts.txns.push({ id: uid(), user_id: me, kind: 'bonus', amount: GIFT_DAILY_BONUS, note: 'Daily bonus', created_at: now() })
  saveDB(db)
  return { balance: w.balance }
}
