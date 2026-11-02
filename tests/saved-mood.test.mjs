import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('saved chat is private, persistent and supports attachments; mood is public and validated', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-saved-'))
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`; let child
  const start = async () => {
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    for (let i = 0; i < 100 && !output.includes('listening on'); i++) { if (child.exitCode !== null) throw new Error(output); await new Promise(r => setTimeout(r, 50)) }
    assert.match(output, /listening on/)
  }
  const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
  const req = async (url, { token, method = 'GET', body } = {}) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: r.status, json: await r.json() }
  }
  try {
    await start()
    const register = async n => (await req('/api/auth/register', { method: 'POST', body: { email: `${n}@example.test`, password: 'secret1', username: n, displayName: n } })).json
    const a = await register('savedalice'), b = await register('savedbob')
    assert.equal((await req('/api/chats/saved', { method: 'POST' })).status, 401)
    const saved = await req('/api/chats/saved', { token: a.token, method: 'POST' }); assert.equal(saved.status, 200)
    const id = saved.json.id
    assert.equal((await req('/api/chats/saved', { token: a.token, method: 'POST' })).json.id, id)
    assert.equal((await req(`/api/chats/${id}/messages`, { token: b.token })).status, 403)
    assert.equal((await req(`/api/chats/${id}/messages`, { token: a.token, method: 'POST', body: { body: 'Private note', attachment: { url: '/uploads/example.png', name: 'example.png', type: 'image/png' } } })).status, 200)
    assert.equal((await req('/api/me', { token: a.token, method: 'PATCH', body: { mood_status: 'Учусь' } })).json.profile.mood_status, 'Учусь')
    assert.equal((await req(`/api/users/${a.profile.id}`, { token: b.token })).json.profile.mood_status, 'Учусь')
    assert.equal((await req('/api/me', { token: a.token, method: 'PATCH', body: { mood_status: 'x'.repeat(81) } })).status, 400)
    const direct = (await req('/api/chats/direct', { token: a.token, method: 'POST', body: { userId: b.profile.id } })).json.id
    assert.equal((await req(`/api/chats/${direct}/theme`, { token: a.token, method: 'PUT', body: { theme: 'ocean' } })).status, 200)
    const themes = ['stardust', 'snowfall', 'embers', 'aurora', 'moonlight', 'rose', 'forest', 'lavender', 'rain', 'cosmos', 'ice', 'sunset', 'neon', 'deepsea', 'gold']
    for (const theme of themes) assert.equal((await req(`/api/chats/${direct}/theme`, { token: a.token, method: 'PUT', body: { theme } })).json.theme, theme)
    assert.equal((await req(`/api/chats/${direct}/theme`, { token: b.token })).json.theme, 'default')
    assert.equal((await req(`/api/chats/${direct}/theme`, { token: a.token })).json.theme, 'gold')
    assert.equal((await req(`/api/chats/${id}/theme`, { token: b.token })).status, 403)
    assert.equal((await req(`/api/chats/${direct}/theme`, { token: a.token, method: 'PUT', body: { theme: 'bad' } })).status, 400)
    await stop(); await start()
    assert.equal((await req('/api/chats/saved', { token: a.token, method: 'POST' })).json.id, id)
    const msgs = (await req(`/api/chats/${id}/messages`, { token: a.token })).json.messages
    assert.equal(msgs[0].body, 'Private note'); assert.equal(msgs[0].attachment_name, 'example.png')
    assert.equal((await req('/api/me', { token: a.token })).json.profile.mood_status, 'Учусь')
    assert.equal((await req(`/api/chats/${direct}/theme`, { token: a.token })).json.theme, 'gold')
  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
