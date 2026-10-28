import { supabase, backendMode } from './supabase'
import { loadDB, saveDB, uid, hashPassword, onLocalChange, maybeAssistantReply } from './localBackend'
import type {
  AttachmentInfo, Channel, ChannelPost, Conversation, Group, GroupMessage,
  Message, Profile, Reaction, ReactionScope, UserSettings,
} from './types'

export const mode = backendMode
const now = () => new Date().toISOString()
const isSb = () => backendMode === 'supabase'

function err(msg: string): never { throw new Error(msg) }

/* ============================== AUTH ============================== */

export async function getCurrentProfile(): Promise<Profile | null> {
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
  if (isSb()) {
    const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
    if (error) err(error.message)
    return
  }
  // Local demo cannot send email — be honest instead of faking success.
  err('Password reset emails require Supabase. In Local Demo Mode, create a new account or use demo@nexo.app / demo1234.')
}

export async function signInWithGoogle(): Promise<void> {
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
  if (isSb()) {
    const { data } = supabase!.auth.onAuthStateChange(() => cb())
    return () => data.subscription.unsubscribe()
  }
  return onLocalChange(cb)
}

/* ============================== PROFILES ============================== */

export async function getProfile(id: string): Promise<Profile | null> {
  if (isSb()) { const { data } = await supabase!.from('profiles').select('*').eq('id', id).maybeSingle(); return (data as Profile) ?? null }
  return loadDB().profiles.find((p) => p.id === id) ?? null
}

export async function getProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const out: Record<string, Profile> = {}
  if (!ids.length) return out
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
  if (isSb()) {
    const { data, error } = await supabase!.from('profiles')
      .select('id, username, display_name, avatar_url, bio, is_online, last_seen, created_at')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq('id', excludeId).limit(limit)
    if (error) err(error.message)
    return (data as Profile[]) || []
  }
  return loadDB().profiles.filter((p) => p.id !== excludeId && (p.username.includes(q) || p.display_name.toLowerCase().includes(q))).slice(0, limit)
}

/* ============================== DIRECT CHATS ============================== */

export interface DirectListItem { conv: Conversation; other: Profile; lastMessage: Message | null; unread: number }

export async function listDirectChats(me: string): Promise<DirectListItem[]> {
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

export async function sendMessage(conversationId: string, senderId: string, body: string, att?: AttachmentInfo): Promise<void> {
  body = body.trim()
  if (!body && !att) err('Message is empty.')
  if (isSb()) {
    const { error } = await supabase!.from('messages').insert({
      conversation_id: conversationId, sender_id: senderId, body,
      attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '',
      attachment_duration: att?.duration || 0,
    })
    if (error) err(error.message)
    await supabase!.from('conversations').update({ last_message_at: now() }).eq('id', conversationId)
    return
  }
  const db = loadDB()
  db.messages.push({ id: uid(), conversation_id: conversationId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, created_at: now() })
  const conv = db.conversations.find((c) => c.id === conversationId); if (conv) conv.last_message_at = now()
  saveDB(db)
  maybeAssistantReply(db, conversationId, senderId)
}

export async function markDirectRead(conversationId: string, userId: string) {
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
  if (isSb()) {
    const { data } = await supabase!.from('conversation_members').select('user_id,last_read_at').eq('conversation_id', conversationId)
    return (data || []).find((m: { user_id: string }) => m.user_id !== meId)?.last_read_at || ''
  }
  const db = loadDB()
  return db.convMembers.find((m) => m.conversation_id === conversationId && m.user_id !== meId)?.last_read_at || ''
}

export async function getDirectPeer(conversationId: string, me: string): Promise<Profile | null> {
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
  if (isSb()) { const { data } = await supabase!.from('groups').select('*').eq('id', id).maybeSingle(); return (data as Group) ?? null }
  return loadDB().groups.find((g) => g.id === id) ?? null
}

export async function getGroupMembers(groupId: string): Promise<{ profile: Profile; role: string }[]> {
  if (isSb()) {
    const { data } = await supabase!.from('group_members').select('*').eq('group_id', groupId)
    const map = await getProfiles((data || []).map((m: { user_id: string }) => m.user_id))
    return (data || []).map((m: { user_id: string; role: string }) => ({ profile: map[m.user_id], role: m.role })).filter((x: { profile?: Profile }) => x.profile)
  }
  const db = loadDB()
  return db.groupMembers.filter((m) => m.group_id === groupId).map((m) => ({ profile: db.profiles.find((p) => p.id === m.user_id)!, role: m.role })).filter((x) => x.profile)
}

export async function addGroupMember(groupId: string, userId: string) {
  if (isSb()) { const { error } = await supabase!.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' }); if (error) err(error.message); return }
  const db = loadDB()
  if (!db.groupMembers.some((m) => m.group_id === groupId && m.user_id === userId))
    db.groupMembers.push({ group_id: groupId, user_id: userId, role: 'member', last_read_at: now(), joined_at: now() })
  saveDB(db)
}

export async function removeGroupMember(groupId: string, userId: string) {
  if (isSb()) { const { error } = await supabase!.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); db.groupMembers = db.groupMembers.filter((m) => !(m.group_id === groupId && m.user_id === userId)); saveDB(db)
}

export async function setGroupRole(groupId: string, userId: string, role: 'admin' | 'member') {
  if (isSb()) { const { error } = await supabase!.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const m = db.groupMembers.find((x) => x.group_id === groupId && x.user_id === userId); if (m) m.role = role; saveDB(db)
}

export async function listGroupMessages(groupId: string, opts: PageOpts = {}): Promise<GroupMessage[]> {
  const limit = opts.limit ?? 60
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

export async function sendGroupMessage(groupId: string, senderId: string, body: string, att?: AttachmentInfo) {
  body = body.trim(); if (!body && !att) err('Message is empty.')
  if (isSb()) {
    const { error } = await supabase!.from('group_messages').insert({ group_id: groupId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0 })
    if (error) err(error.message)
    await supabase!.from('groups').update({ last_message_at: now() }).eq('id', groupId)
    return
  }
  const db = loadDB()
  db.groupMessages.push({ id: uid(), group_id: groupId, sender_id: senderId, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, created_at: now() })
  const g = db.groups.find((x) => x.id === groupId); if (g) g.last_message_at = now()
  saveDB(db)
}

export async function markGroupRead(groupId: string, userId: string) {
  if (isSb()) { await supabase!.from('group_members').update({ last_read_at: now() }).eq('group_id', groupId).eq('user_id', userId); return }
  const db = loadDB(); const m = db.groupMembers.find((x) => x.group_id === groupId && x.user_id === userId)
  if (!m) return
  const hasUnread = db.groupMessages.some((x) => x.group_id === groupId && x.sender_id !== userId && x.created_at > m.last_read_at)
  if (!hasUnread) return
  m.last_read_at = now(); saveDB(db)
}

/* ============================== REACTIONS ============================== */

export async function listReactions(scope: ReactionScope, conversationId: string): Promise<Reaction[]> {
  if (isSb()) {
    const { data, error } = await supabase!.from('message_reactions').select('*').eq('scope', scope).eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(1000)
    if (error) err(error.message)
    return (data as Reaction[]) || []
  }
  return loadDB().reactions.filter((r) => r.scope === scope && r.conversation_id === conversationId)
}

/** Add / change / remove (same emoji again) the user's single reaction to a message. */
export async function toggleReaction(scope: ReactionScope, conversationId: string, messageId: string, userId: string, emoji: string): Promise<void> {
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
  if (isSb()) { const { data } = await supabase!.from('groups').select('*').eq('is_public', true).ilike('name', `%${q}%`).limit(limit); return (data as Group[]) || [] }
  return loadDB().groups.filter((g) => g.is_public && g.name.toLowerCase().includes(q)).slice(0, limit)
}

/* ============================== CHANNELS ============================== */

export interface ChannelListItem { channel: Channel; subscribers: number; myRole: string | null; canPost: boolean }

export async function listChannels(me: string): Promise<ChannelListItem[]> {
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
  if (isSb()) { const { data } = await supabase!.from('channels').select('*').eq('id', id).maybeSingle(); return (data as Channel) ?? null }
  return loadDB().channels.find((c) => c.id === id) ?? null
}

export async function subscribeChannel(channelId: string, userId: string) {
  if (isSb()) { const { error } = await supabase!.from('channel_members').insert({ channel_id: channelId, user_id: userId, role: 'subscriber', can_post: false }); if (error && !error.message.includes('duplicate')) err(error.message); return }
  const db = loadDB()
  if (!db.channelMembers.some((m) => m.channel_id === channelId && m.user_id === userId))
    db.channelMembers.push({ channel_id: channelId, user_id: userId, role: 'subscriber', can_post: false, joined_at: now() })
  saveDB(db)
}

export async function unsubscribeChannel(channelId: string, userId: string) {
  if (isSb()) { const { error } = await supabase!.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); db.channelMembers = db.channelMembers.filter((m) => !(m.channel_id === channelId && m.user_id === userId)); saveDB(db)
}

export async function getChannelMembers(channelId: string): Promise<{ profile: Profile; role: string; can_post: boolean }[]> {
  if (isSb()) {
    const { data } = await supabase!.from('channel_members').select('*').eq('channel_id', channelId)
    const map = await getProfiles((data || []).map((m: { user_id: string }) => m.user_id))
    return (data || []).map((m: { user_id: string; role: string; can_post: boolean }) => ({ profile: map[m.user_id], role: m.role, can_post: m.can_post })).filter((x: { profile?: Profile }) => x.profile)
  }
  const db = loadDB()
  return db.channelMembers.filter((m) => m.channel_id === channelId).map((m) => ({ profile: db.profiles.find((p) => p.id === m.user_id)!, role: m.role, can_post: m.can_post })).filter((x) => x.profile)
}

export async function setChannelPoster(channelId: string, userId: string, canPost: boolean) {
  if (isSb()) { const { error } = await supabase!.from('channel_members').update({ can_post: canPost }).eq('channel_id', channelId).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const m = db.channelMembers.find((x) => x.channel_id === channelId && x.user_id === userId); if (m) m.can_post = canPost; saveDB(db)
}

export async function listPosts(channelId: string): Promise<ChannelPost[]> {
  if (isSb()) {
    const { data, error } = await supabase!.from('channel_posts').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(300)
    if (error) err(error.message)
    return (data as ChannelPost[]) || []
  }
  return loadDB().posts.filter((p) => p.channel_id === channelId).sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function sendPost(channelId: string, authorId: string, body: string, att?: AttachmentInfo) {
  body = body.trim(); if (!body && !att) err('Post is empty.')
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
  if (isSb()) { const { error } = await supabase!.from('user_settings').update({ ...patch, updated_at: now() }).eq('user_id', userId); if (error) err(error.message); return }
  const db = loadDB(); const s = db.settings.find((x) => x.user_id === userId)
  if (s) Object.assign(s, patch, { updated_at: now() }); saveDB(db)
}

/* ============================== REALTIME ============================== */

/** Subscribe to any relevant data change. Local: storage/broadcast. Supabase: postgres changes. */
export function subscribeRoom(kind: 'direct' | 'group' | 'channel', id: string, cb: () => void): () => void {
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
  if (isSb()) {
    const ch = supabase!.channel(`typing-${scope}`)
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') { ch.send({ type: 'broadcast', event: 'typing', payload: { userId: from.id, name: from.display_name, at: Date.now() } }) } })
    setTimeout(() => { supabase!.removeChannel(ch) }, 1200)
    return
  }
  try { typingBc?.postMessage({ scope, userId: from.id, name: from.display_name, at: Date.now() }) } catch { /* noop */ }
}

export function subscribeTyping(scope: string, meId: string, cb: (name: string) => void): () => void {
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
