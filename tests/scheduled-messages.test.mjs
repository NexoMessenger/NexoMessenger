import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('scheduled messages are private, cancellable, persisted and delivered once after restart', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-schedule-'))
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(r => listener.close(r))
  let child
  const start = async () => {
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    for (let i = 0; i < 100 && !output.includes('listening on'); i++) { if (child.exitCode !== null) throw new Error(output); await new Promise(r => setTimeout(r, 50)) }
    assert.match(output, /listening on/)
  }
  const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
  const req = async (url, token, method = 'GET', body) => { const r = await fetch(`http://127.0.0.1:${port}` + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, json: await r.json() } }
  try {
    await start()
    const reg = async n => (await req('/api/auth/register', null, 'POST', { email: `${n}@example.test`, username: n, password: 'secret1', displayName: n })).json
    const a = await reg('scheda'), b = await reg('schedb'), c = await reg('schedc')
    const id = (await req('/api/chats/direct', a.token, 'POST', { userId: b.profile.id })).json.id
    const url = `/api/chats/${id}/scheduled`
    assert.equal((await req(url, c.token)).status, 403)
    assert.equal((await req(url, a.token, 'POST', { body: '', sendAt: new Date(Date.now() + 6000).toISOString() })).status, 400)
    assert.equal((await req(url, a.token, 'POST', { body: 'bad', sendAt: 'invalid' })).status, 400)
    const sendAt = new Date(Date.now() + 8000).toISOString()
    const pending = (await req(url, a.token, 'POST', { body: 'Later!', sendAt })).json.message
    const cancel = (await req(url, a.token, 'POST', { body: 'cancelled', sendAt })).json.message
    assert.equal((await req(`${url}/${pending.id}`, b.token, 'DELETE')).status, 404)
    assert.equal((await req(url, b.token)).json.messages.length, 0)
    assert.equal((await req(`${url}/${cancel.id}`, a.token, 'DELETE')).status, 200)
    assert.equal((await req(`/api/chats/${id}/messages`, b.token)).json.messages.length, 0)
    await stop(); await start()
    assert.equal((await req(url, a.token)).json.messages.length, 1)
    await stop(); await new Promise(r => setTimeout(r, Math.max(0, Date.parse(sendAt) - Date.now() + 50))); await start()
    assert.equal((await req(url, a.token)).json.messages.length, 0)
    assert.deepEqual((await req(`/api/chats/${id}/messages`, b.token)).json.messages.map(x => x.body), ['Later!'])
    await stop(); await start()
    assert.deepEqual((await req(`/api/chats/${id}/messages`, b.token)).json.messages.map(x => x.body), ['Later!'])
    const liveAt = new Date(Date.now() + 5500).toISOString()
    assert.equal((await req(url, a.token, 'POST', { body: 'Live delivery', sendAt: liveAt })).status, 200)
    await new Promise(r => setTimeout(r, 11000))
    assert.deepEqual((await req(`/api/chats/${id}/messages`, b.token)).json.messages.map(x => x.body), ['Later!', 'Live delivery'])
    assert.equal((await req(url, a.token)).json.messages.length, 0)
  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
