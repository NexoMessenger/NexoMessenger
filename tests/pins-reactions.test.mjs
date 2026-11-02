import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('pins are shared with permissions, persisted and premium reactions are enforced', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'nexo-pins-'))
 const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening'); const port = listener.address().port; await new Promise(r => listener.close(r))
 let child
 const start = async () => { child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; child.stdout.on('data', d => { out += d }); child.stderr.on('data', d => { out += d }); for (let i = 0; i < 100 && !out.includes('listening on'); i++) { if (child.exitCode !== null) throw new Error(out); await new Promise(r => setTimeout(r, 50)) }; assert.match(out, /listening on/) }
 const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
 const req = async (url, token, method = 'GET', body) => { const r = await fetch(`http://127.0.0.1:${port}` + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, json: await r.json() } }
 try {
  await start()
  const reg = async n => (await req('/api/auth/register', null, 'POST', { email: `${n}@example.test`, username: n, password: 'secret1', displayName: n })).json
  const a = await reg('pinalice'), b = await reg('pinbob'), c = await reg('pincharlie')
  const chat = (await req('/api/chats/direct', a.token, 'POST', { userId: b.profile.id })).json.id
  const msg = (await req(`/api/chats/${chat}/messages`, a.token, 'POST', { body: 'Important' })).json.message
  const pin = `/api/pin/direct/${chat}`
  assert.equal((await req(pin, c.token)).status, 403)
  assert.equal((await req(pin, a.token, 'PUT', { messageId: 'invalid' })).status, 400)
  assert.equal((await req(pin, b.token, 'PUT', { messageId: msg.id })).status, 200)
  assert.equal((await req(pin, a.token)).json.message.body, 'Important')
  const group = (await req('/api/groups', a.token, 'POST', { name: 'Test', memberIds: [b.profile.id] })).json.id
  const gm = (await req(`/api/groups/${group}/messages`, b.token, 'POST', { body: 'Group pin' })).json.message
  assert.equal((await req(`/api/pin/group/${group}`, b.token, 'PUT', { messageId: gm.id })).status, 403)
  assert.equal((await req(`/api/pin/group/${group}`, a.token, 'PUT', { messageId: msg.id })).status, 400)
  assert.equal((await req(`/api/pin/group/${group}`, a.token, 'PUT', { messageId: gm.id })).status, 200)
  const react = (token, emoji, messageId = msg.id) => req('/api/reactions/toggle', token, 'POST', { scope: 'direct', conversationId: chat, messageId, emoji })
  assert.equal((await react(a.token, '🤯')).status, 200)
  assert.equal((await react(b.token, '🦄')).status, 403)
  assert.equal((await react(a.token, '🔥', gm.id)).status, 400)
  assert.equal((await req('/api/premium/redeem', b.token, 'POST', { code: 'NEXO-PRO-A7K9' })).status, 200)
  assert.equal((await react(b.token, '🦄')).status, 200)
  await stop(); await start()
  assert.equal((await req(pin, b.token)).json.message.id, msg.id)
  assert.equal((await req(`/api/pin/group/${group}`, b.token)).json.message.id, gm.id)
  assert.equal((await req(`/api/reactions?scope=direct&room=${chat}`, a.token)).json.reactions.length, 2)
  assert.equal((await req(pin, a.token, 'PUT', { messageId: null })).status, 200)
  assert.equal((await req(pin, b.token)).json.message, null)
  await req(`/api/groups/${group}/messages/${gm.id}`, b.token, 'DELETE')
  assert.equal((await req(`/api/pin/group/${group}`, a.token)).json.message, null)
 } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
