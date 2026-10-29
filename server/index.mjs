/**
 * NEXO Messenger — self-hosted website server.
 *
 * One Node process = the whole website:
 *   - serves the built frontend (dist/) at http://<server-ip>/
 *   - REST API under /api (accounts, sessions, profiles, chats, groups,
 *     channels, reactions, settings, uploads)
 *   - WebSocket realtime under /ws (message events + typing)
 *   - data stored on THIS server in <site-root>/data/db.json (+ uploads/),
 *     never in visitors' browsers — that's what makes real people visible
 *     to each other from different devices.
 *
 * Run:  npm run build:server && PORT=80 node server/index.mjs
 * Env:  PORT (default 8080), HOST (default 0.0.0.0), NEXO_DATA_DIR.
 */
import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
// Data lives NEXT TO the code folders (site-root/data), never inside
// server/ — the deploy pipeline wipes server/ and dist/ before uploading
// fresh code, and the database must survive every deploy untouched.
const DATA_DIR = process.env.NEXO_DATA_DIR || path.join(ROOT, 'data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const DIST_DIR = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_UPLOAD = 25 * 1024 * 1024

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const now = () => new Date().toISOString()
const uid = () => crypto.randomBytes(9).toString('hex') + Date.now().toString(36)
const tokenGen = () => crypto.randomBytes(32).toString('hex')

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex')
}
function verifyPassword(password, user) {
  const h = Buffer.from(hashPassword(password, user.salt), 'hex')
  const orig = Buffer.from(user.passwordHash, 'hex')
  return h.length === orig.length && crypto.timingSafeEqual(h, orig)
}

/* ============================== DB ============================== */

function seed() {
  const t = now()
  const salt = uid()
  const assistant = { id: 'u_assistant', username: 'nexo', display_name: 'NEXO Assistant', avatar_url: '', bio: 'Official NEXO assistant.', is_online: true, last_seen: t, created_at: t }
  const profiles = [
    { id: 'demo_user', username: 'demo', display_name: 'Demo User', avatar_url: '', bio: 'Trying out NEXO Messenger', is_online: false, last_seen: t, created_at: t },
    assistant,
    { id: 'u_mira', username: 'Mira', display_name: 'Mira Chen', avatar_url: '', bio: 'Product designer · Berlin', is_online: true, last_seen: t, created_at: t },
    { id: 'u_kai', username: 'Kai', display_name: 'Kai Morgan', avatar_url: '', bio: 'Building things for the web', is_online: false, last_seen: t, created_at: t },
    { id: 'u_lena', username: 'lena', display_name: 'Lena Hoffmann', avatar_url: '', bio: 'Photography & travel', is_online: true, last_seen: t, created_at: t },
  ]
  const design = { id: 'g_design', name: 'Design Circle', avatar_url: '', description: 'Premium UI, glassmorphism and motion.', owner_id: 'u_mira', is_public: true, created_at: t, last_message_at: t }
  const news = { id: 'c_news', name: 'NEXO Updates', avatar_url: '', description: 'Official announcements from the NEXO team.', owner_id: 'u_assistant', is_public: true, created_at: t }
  return {
    users: [{ id: 'demo_user', email: 'demo@nexo.app', passwordHash: hashPassword('demo1234', salt), salt }],
    profiles,
    conversations: [], convMembers: [], messages: [],
    groups: [design],
    groupMembers: [
      { group_id: 'g_design', user_id: 'u_mira', role: 'owner', last_read_at: t, joined_at: t },
      { group_id: 'g_design', user_id: 'u_kai', role: 'member', last_read_at: t, joined_at: t },
      { group_id: 'g_design', user_id: 'u_lena', role: 'member', last_read_at: t, joined_at: t },
    ],
    groupMessages: [{ id: uid(), group_id: 'g_design', sender_id: 'u_mira', body: 'Welcome to Design Circle — share your latest glass UI experiments here.', attachment_url: '', attachment_name: '', attachment_type: '', attachment_duration: 0, created_at: t }],
    channels: [news],
    channelMembers: [{ channel_id: 'c_news', user_id: 'u_assistant', role: 'owner', can_post: true, joined_at: t }],
    posts: [{ id: uid(), channel_id: 'c_news', author_id: 'u_assistant', body: 'Welcome to NEXO Messenger. This is a public channel — subscribe to receive broadcasts.', attachment_url: '', attachment_name: '', attachment_type: '', created_at: t }],
    reactions: [], settings: [], sessions: [],
  }
}

// One-time migration: the first website edition kept data in server/data.
// If the new location is empty but the old one has a database, copy it over
// (old copy is kept as a backup) so existing accounts survive the upgrade.
const OLD_DATA_DIR = path.join(__dirname, 'data')
try {
  if (OLD_DATA_DIR !== DATA_DIR && !fs.existsSync(DB_FILE) && fs.existsSync(path.join(OLD_DATA_DIR, 'db.json'))) {
    fs.cpSync(OLD_DATA_DIR, DATA_DIR, { recursive: true })
    console.log(`Migrated data directory: ${OLD_DATA_DIR} -> ${DATA_DIR}`)
  }
} catch (e) {
  console.error('Data migration failed:', e)
}

let db
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  if (!Array.isArray(db.sessions)) db.sessions = []
  if (!Array.isArray(db.reactions)) db.reactions = []
} catch {
  db = seed()
  persist()
}
function persist() {
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DB_FILE)
}

/* ============================== helpers ============================== */

const profileOf = (id) => db.profiles.find((p) => p.id === id) || null
const isConvMember = (cid, uidv) => db.convMembers.some((m) => m.conversation_id === cid && m.user_id === uidv)
const groupMember = (gid, uidv) => db.groupMembers.find((m) => m.group_id === gid && m.user_id === uidv)
const isGroupAdmin = (gid, uidv) => { const m = groupMember(gid, uidv); return Boolean(m && (m.role === 'owner' || m.role === 'admin')) }
const channelMember = (cid, uidv) => db.channelMembers.find((m) => m.channel_id === cid && m.user_id === uidv)
const canPostChannel = (cid, uidv) => {
  const ch = db.channels.find((c) => c.id === cid)
  const m = channelMember(cid, uidv)
  return Boolean(ch && (ch.owner_id === uidv || (m && (m.role === 'owner' || m.role === 'admin' || m.can_post))))
}

function fail(res, status, message) { return res.status(status).json({ error: message }) }

const authHits = new Map()
function rateLimitAuth(req, res, next) {
  const key = req.ip || 'ip'
  const t = Date.now()
  const hits = (authHits.get(key) || []).filter((x) => t - x < 5 * 60 * 1000)
  if (hits.length > 60) return fail(res, 429, 'Too many attempts. Try again in a few minutes.')
  hits.push(t); authHits.set(key, hits)
  next()
}

function sessionUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const s = db.sessions.find((x) => x.token === token)
  if (!s || s.expires_at < Date.now()) return null
  return profileOf(s.user_id)
}
function auth(req, res, next) {
  const me = sessionUser(req)
  if (!me) return fail(res, 401, 'Session expired. Please sign in again.')
  req.me = me
  next()
}

/* ============================== realtime ============================== */

const clients = new Set() // {ws, userId, rooms:Set<string>}
function touch(kind, id) {
  const msg = JSON.stringify({ t: 'changed', kind, id })
  for (const c of clients) {
    if (c.ws.readyState !== 1) continue
    if (c.rooms.has('global') || c.rooms.has(`${kind}:${id}`)) { try { c.ws.send(msg) } catch { /* noop */ } }
  }
}
function touchGlobal() {
  const msg = JSON.stringify({ t: 'changed', kind: 'global', id: '' })
  for (const c of clients) { if (c.ws.readyState === 1 && c.rooms.has('global')) { try { c.ws.send(msg) } catch { /* noop */ } } }
}

/* ============================== app ============================== */

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32mb' }))
app.use('/api/files', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '7d' }))

app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'server', users: db.profiles.length }))

/* ---------- auth ---------- */
app.post('/api/auth/register', rateLimitAuth, (req, res) => {
  const { email, password, username, displayName } = req.body || {}
  const uname = String(username || '').toLowerCase().trim().replace(/^@/, '')
  if (!/^[a-z0-9_.]{3,24}$/.test(uname)) return fail(res, 400, 'Username: 3–24 chars, lowercase letters, digits, _ or .')
  if (String(password || '').length < 6) return fail(res, 400, 'Password must be at least 6 characters.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ''))) return fail(res, 400, 'Invalid email or password.')
  if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) return fail(res, 400, 'An account with this email already exists.')
  if (db.profiles.some((p) => p.username === uname)) return fail(res, 400, 'That @username is already taken.')
  const salt = uid()
  const id = uid()
  db.users.push({ id, email: String(email), passwordHash: hashPassword(password, salt), salt })
  const profile = { id, username: uname, display_name: String(displayName || uname).slice(0, 60), avatar_url: '', bio: '', is_online: true, last_seen: now(), created_at: now() }
  db.profiles.push(profile)
  const token = tokenGen()
  db.sessions.push({ token, user_id: id, expires_at: Date.now() + SESSION_TTL })
  persist(); touchGlobal()
  res.json({ token, profile })
})

app.post('/api/auth/login', rateLimitAuth, (req, res) => {
  const { email, password } = req.body || {}
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase())
  if (!user || !verifyPassword(password || '', user)) return fail(res, 401, 'Invalid email or password.')
  const profile = profileOf(user.id)
  if (profile) { profile.is_online = true; profile.last_seen = now() }
  const token = tokenGen()
  db.sessions.push({ token, user_id: user.id, expires_at: Date.now() + SESSION_TTL })
  persist(); touchGlobal()
  res.json({ token, profile })
})

app.post('/api/auth/logout', auth, (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  db.sessions = db.sessions.filter((s) => s.token !== token)
  req.me.is_online = false; req.me.last_seen = now()
  persist(); touchGlobal()
  res.json({ ok: true })
})

/* ---------- me / profiles / settings ---------- */
app.get('/api/me', auth, (req, res) => res.json({ profile: req.me }))

app.patch('/api/me', auth, (req, res) => {
  const patch = req.body || {}
  if (patch.username !== undefined) {
    const uname = String(patch.username).toLowerCase().trim().replace(/^@/, '')
    if (!/^[a-z0-9_.]{3,24}$/.test(uname)) return fail(res, 400, 'Username: 3–24 chars, lowercase letters, digits, _ or .')
    if (db.profiles.some((p) => p.username === uname && p.id !== req.me.id)) return fail(res, 400, 'That @username is already taken.')
    req.me.username = uname
  }
  for (const k of ['display_name', 'bio', 'avatar_url']) {
    if (patch[k] !== undefined) req.me[k] = String(patch[k]).slice(0, k === 'bio' ? 300 : 1000)
  }
  persist(); touchGlobal()
  res.json({ profile: req.me })
})

app.post('/api/me/presence', auth, (req, res) => {
  const online = Boolean(req.body?.online)
  if (req.me.is_online !== online) { req.me.is_online = online; touchGlobal() }
  req.me.last_seen = now()
  persist()
  res.json({ ok: true })
})

app.get('/api/settings', auth, (req, res) => {
  let s = db.settings.find((x) => x.user_id === req.me.id)
  if (!s) { s = { user_id: req.me.id, theme: 'nexoglass', notifications_enabled: true, privacy_profile: 'public', updated_at: now() }; db.settings.push(s); persist() }
  res.json({ settings: s })
})

app.put('/api/settings', auth, (req, res) => {
  let s = db.settings.find((x) => x.user_id === req.me.id)
  if (!s) { s = { user_id: req.me.id, theme: 'nexoglass', notifications_enabled: true, privacy_profile: 'public', updated_at: now() }; db.settings.push(s) }
  Object.assign(s, req.body || {}, { user_id: req.me.id, updated_at: now() })
  persist()
  res.json({ settings: s })
})

app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().replace(/^@+/, '')
  if (!q) return res.json({ users: [] })
  const limit = Math.min(50, Number(req.query.limit || 20))
  const users = db.profiles.filter((p) => p.id !== req.me.id && (p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q))).slice(0, limit)
  res.json({ users })
})

app.get('/api/users/:id', auth, (req, res) => {
  const p = profileOf(req.params.id)
  if (!p) return fail(res, 404, 'Profile not found.')
  res.json({ profile: p })
})

app.get('/api/users', auth, (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean)
  res.json({ profiles: ids.map((id) => profileOf(id)).filter(Boolean) })
})

/* ---------- direct chats ---------- */
app.get('/api/chats', auth, (req, res) => {
  const me = req.me.id
  const items = db.convMembers.filter((m) => m.user_id === me).map((m) => {
    const conv = db.conversations.find((c) => c.id === m.conversation_id)
    if (!conv) return null
    const otherId = db.convMembers.find((x) => x.conversation_id === conv.id && x.user_id !== me)?.user_id
    const other = otherId ? profileOf(otherId) : null
    if (!other) return null
    const msgs = db.messages.filter((x) => x.conversation_id === conv.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { conv, other, lastMessage: msgs[msgs.length - 1] ?? null, unread: msgs.filter((x) => x.sender_id !== me && x.created_at > m.last_read_at).length }
  }).filter(Boolean).sort((a, b) => b.conv.last_message_at.localeCompare(a.conv.last_message_at))
  res.json({ items })
})

app.post('/api/chats/direct', auth, (req, res) => {
  const otherId = String(req.body?.userId || '')
  if (otherId === req.me.id) return fail(res, 400, 'You cannot message yourself.')
  if (!profileOf(otherId)) return fail(res, 404, 'Profile not found.')
  const existing = db.convMembers.filter((m) => m.user_id === req.me.id).map((m) => m.conversation_id)
    .find((cid) => db.convMembers.some((m) => m.conversation_id === cid && m.user_id === otherId))
  if (existing) return res.json({ id: existing })
  const conv = { id: uid(), created_by: req.me.id, created_at: now(), last_message_at: now() }
  db.conversations.push(conv)
  db.convMembers.push(
    { conversation_id: conv.id, user_id: req.me.id, last_read_at: now(), joined_at: now() },
    { conversation_id: conv.id, user_id: otherId, last_read_at: now(), joined_at: now() },
  )
  persist(); touch('direct', conv.id); touchGlobal()
  res.json({ id: conv.id })
})

app.get('/api/chats/:id/peer', auth, (req, res) => {
  if (!isConvMember(req.params.id, req.me.id)) return fail(res, 403, 'Profile not found.')
  const otherId = db.convMembers.find((m) => m.conversation_id === req.params.id && m.user_id !== req.me.id)?.user_id
  res.json({ profile: otherId ? profileOf(otherId) : null })
})

app.get('/api/chats/:id/peer-read', auth, (req, res) => {
  const m = db.convMembers.find((x) => x.conversation_id === req.params.id && x.user_id !== req.me.id)
  res.json({ last_read_at: m?.last_read_at || '' })
})

app.get('/api/chats/:id/messages', auth, (req, res) => {
  if (!isConvMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const limit = Math.min(200, Number(req.query.limit || 60))
  let all = db.messages.filter((m) => m.conversation_id === req.params.id)
  if (req.query.before) all = all.filter((m) => m.created_at < String(req.query.before))
  res.json({ messages: all.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit) })
})

app.post('/api/chats/:id/messages', auth, (req, res) => {
  if (!isConvMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const body = String(req.body?.body || '').trim()
  const att = req.body?.attachment || null
  if (!body && !att) return fail(res, 400, 'Message is empty.')
  const msg = { id: uid(), conversation_id: req.params.id, sender_id: req.me.id, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, created_at: now() }
  db.messages.push(msg)
  const conv = db.conversations.find((c) => c.id === req.params.id); if (conv) conv.last_message_at = msg.created_at
  persist(); touch('direct', req.params.id); touchGlobal()
  res.json({ message: msg })
})

app.post('/api/chats/:id/read', auth, (req, res) => {
  const m = db.convMembers.find((x) => x.conversation_id === req.params.id && x.user_id === req.me.id)
  if (m) {
    const hasUnread = db.messages.some((x) => x.conversation_id === req.params.id && x.sender_id !== req.me.id && x.created_at > m.last_read_at)
    if (hasUnread) { m.last_read_at = now(); persist(); touch('direct', req.params.id) }
  }
  res.json({ ok: true })
})

/* ---------- groups ---------- */
app.get('/api/groups/search', auth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (!q) return res.json({ groups: [] })
  res.json({ groups: db.groups.filter((g) => g.is_public && g.name.toLowerCase().includes(q)).slice(0, 20) })
})

app.get('/api/groups', auth, (req, res) => {
  const me = req.me.id
  const items = db.groupMembers.filter((m) => m.user_id === me).map((m) => {
    const group = db.groups.find((g) => g.id === m.group_id)
    if (!group) return null
    const msgs = db.groupMessages.filter((x) => x.group_id === group.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    return { group, myRole: m.role, memberCount: db.groupMembers.filter((x) => x.group_id === group.id).length, lastMessage: msgs[msgs.length - 1] ?? null, unread: msgs.filter((x) => x.sender_id !== me && x.created_at > m.last_read_at).length }
  }).filter(Boolean).sort((a, b) => b.group.last_message_at.localeCompare(a.group.last_message_at))
  res.json({ items })
})

app.post('/api/groups', auth, (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return fail(res, 400, 'Group name is required.')
  const group = { id: uid(), name, avatar_url: '', description: String(req.body?.description || ''), owner_id: req.me.id, is_public: Boolean(req.body?.isPublic), created_at: now(), last_message_at: now() }
  db.groups.push(group)
  db.groupMembers.push({ group_id: group.id, user_id: req.me.id, role: 'owner', last_read_at: now(), joined_at: now() })
  for (const userId of new Set(req.body?.memberIds || [])) {
    if (userId !== req.me.id && profileOf(userId)) db.groupMembers.push({ group_id: group.id, user_id: userId, role: 'member', last_read_at: now(), joined_at: now() })
  }
  persist(); touch('group', group.id); touchGlobal()
  res.json({ id: group.id })
})

app.get('/api/groups/:id', auth, (req, res) => {
  const g = db.groups.find((x) => x.id === req.params.id)
  if (!g || (!g.is_public && !groupMember(g.id, req.me.id))) return fail(res, 404, 'Profile not found.')
  res.json({ group: g })
})

app.get('/api/groups/:id/members', auth, (req, res) => {
  if (!groupMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const members = db.groupMembers.filter((m) => m.group_id === req.params.id)
    .map((m) => ({ profile: profileOf(m.user_id), role: m.role })).filter((x) => x.profile)
  res.json({ members })
})

app.post('/api/groups/:id/join', auth, (req, res) => {
  const g = db.groups.find((x) => x.id === req.params.id)
  if (!g) return fail(res, 404, 'Profile not found.')
  if (!g.is_public && !groupMember(g.id, req.me.id)) return fail(res, 403, 'Access denied.')
  if (!groupMember(g.id, req.me.id)) {
    db.groupMembers.push({ group_id: g.id, user_id: req.me.id, role: 'member', last_read_at: now(), joined_at: now() })
    persist(); touch('group', g.id); touchGlobal()
  }
  res.json({ ok: true })
})

app.post('/api/groups/:id/members', auth, (req, res) => {
  const userId = String(req.body?.userId || '')
  const g = db.groups.find((x) => x.id === req.params.id)
  if (!g || !profileOf(userId)) return fail(res, 404, 'Profile not found.')
  const selfJoin = userId === req.me.id && g.is_public
  if (!selfJoin && !isGroupAdmin(g.id, req.me.id)) return fail(res, 403, 'Access denied.')
  if (!groupMember(g.id, userId)) {
    db.groupMembers.push({ group_id: g.id, user_id: userId, role: 'member', last_read_at: now(), joined_at: now() })
    persist(); touch('group', g.id); touchGlobal()
  }
  res.json({ ok: true })
})

app.delete('/api/groups/:id/members/:userId', auth, (req, res) => {
  const g = db.groups.find((x) => x.id === req.params.id)
  if (!g) return fail(res, 404, 'Profile not found.')
  if (g.owner_id === req.params.userId) return fail(res, 400, 'Access denied.')
  if (req.params.userId !== req.me.id && !isGroupAdmin(g.id, req.me.id)) return fail(res, 403, 'Access denied.')
  db.groupMembers = db.groupMembers.filter((m) => !(m.group_id === g.id && m.user_id === req.params.userId))
  persist(); touch('group', g.id); touchGlobal()
  res.json({ ok: true })
})

app.patch('/api/groups/:id/members/:userId/role', auth, (req, res) => {
  const g = db.groups.find((x) => x.id === req.params.id)
  if (!g || g.owner_id === req.params.userId || !isGroupAdmin(g.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const m = groupMember(g.id, req.params.userId)
  if (m && (req.body?.role === 'admin' || req.body?.role === 'member')) { m.role = req.body.role; persist(); touch('group', g.id) }
  res.json({ ok: true })
})

app.get('/api/groups/:id/messages', auth, (req, res) => {
  if (!groupMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const limit = Math.min(200, Number(req.query.limit || 60))
  let all = db.groupMessages.filter((m) => m.group_id === req.params.id)
  if (req.query.before) all = all.filter((m) => m.created_at < String(req.query.before))
  res.json({ messages: all.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit) })
})

app.post('/api/groups/:id/messages', auth, (req, res) => {
  if (!groupMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const body = String(req.body?.body || '').trim()
  const att = req.body?.attachment || null
  if (!body && !att) return fail(res, 400, 'Message is empty.')
  const msg = { id: uid(), group_id: req.params.id, sender_id: req.me.id, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', attachment_duration: att?.duration || 0, created_at: now() }
  db.groupMessages.push(msg)
  const g = db.groups.find((x) => x.id === req.params.id); if (g) g.last_message_at = msg.created_at
  persist(); touch('group', req.params.id); touchGlobal()
  res.json({ message: msg })
})

app.post('/api/groups/:id/read', auth, (req, res) => {
  const m = groupMember(req.params.id, req.me.id)
  if (m) {
    const hasUnread = db.groupMessages.some((x) => x.group_id === req.params.id && x.sender_id !== req.me.id && x.created_at > m.last_read_at)
    if (hasUnread) { m.last_read_at = now(); persist(); touch('group', req.params.id) }
  }
  res.json({ ok: true })
})

/* ---------- channels ---------- */
app.get('/api/channels/search', auth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase()
  if (!q) return res.json({ channels: [] })
  res.json({ channels: db.channels.filter((c) => c.is_public && c.name.toLowerCase().includes(q)).slice(0, 20) })
})

app.get('/api/channels', auth, (req, res) => {
  const me = req.me.id
  const items = db.channels.filter((c) => c.is_public || channelMember(c.id, me) || c.owner_id === me).map((channel) => {
    const mine = channelMember(channel.id, me)
    return { channel, subscribers: db.channelMembers.filter((m) => m.channel_id === channel.id).length, myRole: mine?.role ?? (channel.owner_id === me ? 'owner' : null), canPost: canPostChannel(channel.id, me) }
  }).sort((a, b) => Number(b.myRole !== null) - Number(a.myRole !== null))
  res.json({ items })
})

app.post('/api/channels', auth, (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return fail(res, 400, 'Channel name is required.')
  const ch = { id: uid(), name, avatar_url: '', description: String(req.body?.description || ''), owner_id: req.me.id, is_public: Boolean(req.body?.isPublic), created_at: now() }
  db.channels.push(ch)
  db.channelMembers.push({ channel_id: ch.id, user_id: req.me.id, role: 'owner', can_post: true, joined_at: now() })
  persist(); touch('channel', ch.id); touchGlobal()
  res.json({ id: ch.id })
})

app.get('/api/channels/:id', auth, (req, res) => {
  const c = db.channels.find((x) => x.id === req.params.id)
  if (!c || (!c.is_public && !channelMember(c.id, req.me.id))) return fail(res, 404, 'Profile not found.')
  res.json({ channel: c })
})

app.get('/api/channels/:id/members', auth, (req, res) => {
  if (!channelMember(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const members = db.channelMembers.filter((m) => m.channel_id === req.params.id)
    .map((m) => ({ profile: profileOf(m.user_id), role: m.role, can_post: m.can_post })).filter((x) => x.profile)
  res.json({ members })
})

app.post('/api/channels/:id/subscribe', auth, (req, res) => {
  if (!db.channels.find((c) => c.id === req.params.id)) return fail(res, 404, 'Profile not found.')
  if (!channelMember(req.params.id, req.me.id)) {
    db.channelMembers.push({ channel_id: req.params.id, user_id: req.me.id, role: 'subscriber', can_post: false, joined_at: now() })
    persist(); touch('channel', req.params.id); touchGlobal()
  }
  res.json({ ok: true })
})

app.post('/api/channels/:id/unsubscribe', auth, (req, res) => {
  db.channelMembers = db.channelMembers.filter((m) => !(m.channel_id === req.params.id && m.user_id === req.me.id))
  persist(); touch('channel', req.params.id); touchGlobal()
  res.json({ ok: true })
})

app.patch('/api/channels/:id/members/:userId/poster', auth, (req, res) => {
  if (!canPostChannel(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const m = channelMember(req.params.id, req.params.userId)
  if (m) { m.can_post = Boolean(req.body?.canPost); persist(); touch('channel', req.params.id) }
  res.json({ ok: true })
})

app.get('/api/channels/:id/posts', auth, (req, res) => {
  const c = db.channels.find((x) => x.id === req.params.id)
  if (!c || (!c.is_public && !channelMember(c.id, req.me.id))) return fail(res, 403, 'Access denied.')
  res.json({ posts: db.posts.filter((p) => p.channel_id === c.id).sort((a, b) => a.created_at.localeCompare(b.created_at)) })
})

app.post('/api/channels/:id/posts', auth, (req, res) => {
  if (!canPostChannel(req.params.id, req.me.id)) return fail(res, 403, 'Access denied.')
  const body = String(req.body?.body || '').trim()
  const att = req.body?.attachment || null
  if (!body && !att) return fail(res, 400, 'Post is empty.')
  const post = { id: uid(), channel_id: req.params.id, author_id: req.me.id, body, attachment_url: att?.url || '', attachment_name: att?.name || '', attachment_type: att?.type || '', created_at: now() }
  db.posts.push(post)
  persist(); touch('channel', req.params.id); touchGlobal()
  res.json({ post })
})

/* ---------- reactions ---------- */
app.get('/api/reactions', auth, (req, res) => {
  const scope = String(req.query.scope || '')
  const room = String(req.query.room || '')
  const allowed = scope === 'direct' ? isConvMember(room, req.me.id) : scope === 'group' ? Boolean(groupMember(room, req.me.id)) : false
  if (!allowed) return fail(res, 403, 'Access denied.')
  res.json({ reactions: db.reactions.filter((r) => r.scope === scope && r.conversation_id === room) })
})

app.post('/api/reactions/toggle', auth, (req, res) => {
  const { scope, conversationId, messageId, emoji } = req.body || {}
  const allowed = scope === 'direct' ? isConvMember(String(conversationId), req.me.id) : scope === 'group' ? Boolean(groupMember(String(conversationId), req.me.id)) : false
  if (!allowed || !messageId || !emoji) return fail(res, 403, 'Access denied.')
  const idx = db.reactions.findIndex((r) => r.message_id === messageId && r.user_id === req.me.id)
  if (idx >= 0 && db.reactions[idx].emoji === emoji) db.reactions.splice(idx, 1)
  else if (idx >= 0) db.reactions[idx].emoji = String(emoji)
  else db.reactions.push({ id: uid(), scope, conversation_id: String(conversationId), message_id: String(messageId), user_id: req.me.id, emoji: String(emoji), created_at: now() })
  persist(); touch(scope === 'direct' ? 'direct' : 'group', String(conversationId))
  res.json({ ok: true })
})

/* ---------- uploads ---------- */
function saveUpload(req, res) {
  const { name, type, data } = req.body || {}
  if (!data) return fail(res, 400, 'Upload failed.')
  const buf = Buffer.from(String(data), 'base64')
  if (!buf.length || buf.length > MAX_UPLOAD) return fail(res, 400, 'File is too large (max 25 MB).')
  const safe = String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const fn = `${crypto.randomBytes(16).toString('hex')}_${safe}`
  fs.writeFileSync(path.join(UPLOAD_DIR, fn), buf)
  res.json({ url: `/api/files/${fn}`, name: String(name || 'file'), type: String(type || '') })
}
app.post('/api/upload', auth, saveUpload)
app.post('/api/avatar', auth, saveUpload)

/* ---------- frontend (website) ---------- */
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
} else {
  app.get('/', (req, res) => res.json({ ok: true, mode: 'server', hint: 'Frontend not built yet. Run: npm run build:server' }))
}
app.use('/api', (req, res) => fail(res, 404, 'Not found.'))

/* ============================== http + ws ============================== */

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const token = url.searchParams.get('token') || ''
  const s = db.sessions.find((x) => x.token === token && x.expires_at > Date.now())
  if (!s) { ws.close(4401, 'unauthorized'); return }
  const client = { ws, userId: s.user_id, rooms: new Set(['global']) }
  clients.add(client)
  const p = profileOf(s.user_id)
  if (p && !p.is_online) { p.is_online = true; p.last_seen = now(); persist(); touchGlobal() }
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(String(raw))
      if (m.t === 'sub' && m.kind && m.id) client.rooms.add(`${m.kind}:${m.id}`)
      if (m.t === 'typing' && m.scope) {
        const out = JSON.stringify({ t: 'typing', scope: String(m.scope), userId: client.userId, name: String(m.name || '') })
        for (const c of clients) { if (c !== client && c.ws.readyState === 1) { try { c.ws.send(out) } catch { /* noop */ } } }
      }
    } catch { /* ignore malformed frames */ }
  })
  ws.on('close', () => {
    clients.delete(client)
    const stillOnline = [...clients].some((c) => c.userId === client.userId)
    const prof = profileOf(client.userId)
    if (!stillOnline && prof && prof.is_online) { prof.is_online = false; prof.last_seen = now(); persist(); touchGlobal() }
  })
})

setInterval(() => {
  const t = Date.now()
  const before = db.sessions.length
  db.sessions = db.sessions.filter((s) => s.expires_at > t)
  if (db.sessions.length !== before) persist()
}, 60 * 60 * 1000).unref()

server.listen(PORT, HOST, () => {
  console.log(`NEXO server listening on http://${HOST}:${PORT} (data: ${DATA_DIR})`)
})
