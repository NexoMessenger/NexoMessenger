import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
import WebSocket from 'ws'

test('recipient receives the recorded attachment and can fetch its bytes', async () => {
  const listener = net.createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-video-test-'))
  const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = '', ws
  child.stdout.on('data', chunk => { logs += chunk })
  child.stderr.on('data', chunk => { logs += chunk })
  const base = `http://127.0.0.1:${port}`
  const request = async (url, token, body) => {
    const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    assert.ok(res.ok, `${res.status} ${url}`)
    return res.json()
  }
  try {
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
      if (child.exitCode !== null) throw new Error(logs)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.match(logs, /listening on/)
    const register = name => request('/api/auth/register', null, { email: `${name}@example.test`, password: 'secret1', username: name, displayName: name })
    const alice = await register('alicevideo'), bob = await register('bobvideo')
    const { id } = await request('/api/chats/direct', alice.token, { userId: bob.profile.id })
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${bob.token}`)
    await once(ws, 'open')
    const bytes = Buffer.from('mock-webm-content-for-transport')
    const name = 'circle-test.webm', type = 'video/webm'
    const uploaded = await request('/api/upload', alice.token, { name, type, data: bytes.toString('base64') })
    const delivered = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('No realtime event')), 3000)
      ws.on('message', raw => { const m = JSON.parse(String(raw)); if (m.t === 'changed' && m.kind === 'direct' && m.id === id) { clearTimeout(timeout); resolve() } })
    })
    await request(`/api/chats/${id}/messages`, alice.token, { body: '', attachment: { url: uploaded.url, name, type, duration: 3 } })
    await delivered
    const { messages } = await request(`/api/chats/${id}/messages`, bob.token)
    const message = messages.at(-1)
    assert.equal(message.attachment_url, uploaded.url)
    assert.equal(message.attachment_type, type)
    assert.equal(message.attachment_duration, 3)
    const file = await fetch(base + message.attachment_url)
    assert.equal(file.status, 200)
    assert.match(file.headers.get('content-type'), /^video\/webm/)
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes)
    const partial = await fetch(base + message.attachment_url, { headers: { Range: 'bytes=0-3' } })
    assert.equal(partial.status, 206)
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 4))
  } finally {
    ws?.terminate()
    child.kill('SIGTERM')
    if (child.exitCode === null) await once(child, 'exit')
    await rm(dir, { recursive: true, force: true })
  }
})
