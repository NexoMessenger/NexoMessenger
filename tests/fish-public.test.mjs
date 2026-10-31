import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { once } from 'node:events'

test('cloud voice authenticates, restricts content and persists per-user quota', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-fish-'))
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`
  let child
  const start = async () => {
    child = spawn(process.execPath, ['--import', './tests/mock-openrouter.mjs', '--import', './tests/mock-fish.mjs', 'server/index.mjs'], { env: { ...process.env, NEXO_DATA_DIR: dir, PORT: String(port), FISH_API_KEY: 'fake', FISH_TEST_USER_ID: 'demo_user', GIGACHAT_AUTH_KEY: 'test-key', FISH_MOCK_LOG: path.join(dir, 'fish-calls.log') }, stdio: ['ignore', 'pipe', 'pipe'] })
    let logs = ''; child.stdout.on('data', d => { logs += d }); child.stderr.on('data', d => { logs += d })
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) await new Promise(r => setTimeout(r, 50))
    assert.match(logs, /listening on/)
  }
  const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
  const request = (p, token, body) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  try {
    await start()
    const demo = await (await request('/api/auth/login', null, { email: 'demo@nexo.app', password: 'demo1234' })).json()
    const other = await (await request('/api/auth/register', null, { email: 'other@example.test', password: 'pass123', username: 'otheruser' })).json()
    assert.equal((await request('/api/ai/voice/status')).status, 401)
    assert.equal((await (await request('/api/ai/voice/status', other.token)).json()).available, true)
    assert.equal((await request('/api/ai/voice', demo.token, { text: 'arbitrary' })).status, 400)
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: 'greeting', locale: 'invalid' })).status, 400)
    const response = await (await request('/api/ai/message', demo.token, { text: 'hi' })).json()
    const id = response.messages[1].id
    assert.equal((await request('/api/ai/voice', other.token, { message_id: id, locale: 'ru' })).status, 400)
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: response.messages[0].id, locale: 'ru' })).status, 400)
    // The same greeting is generated once for all accounts and survives restarts.
    const greetings = await Promise.all(Array.from({ length: 5 }, () => request('/api/ai/voice', demo.token, { message_id: 'greeting', locale: 'ru' })))
    for (const r of greetings) { assert.equal(r.status, 200); assert.equal(await r.text(), 'mock mp3') }
    assert.equal((await readFile(path.join(dir, 'fish-calls.log'), 'utf8')).trim().split('\n').length, 1)
    assert.equal((await request('/api/ai/voice', other.token, { message_id: 'greeting', locale: 'ru' })).status, 200)
    assert.equal((await request('/api/ai/voice', other.token, { message_id: 'greeting', locale: 'zh-CN' })).status, 200)
    assert.equal((await readFile(path.join(dir, 'fish-calls.log'), 'utf8')).trim().split('\n').length, 2)
    // Only normal answers consume the user's quota.
    for (let i = 0; i < 50; i++) { const r = await request('/api/ai/voice', demo.token, { message_id: id, locale: 'ru' }); assert.equal(r.status, 200) }
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: id, locale: 'ru' })).status, 429)
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: 'greeting', locale: 'ru' })).status, 200)
    const count = (await readFile(path.join(dir, 'fish-calls.log'), 'utf8')).trim().split('\n').length
    assert.equal(count, 52)
    await stop(); await start()
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: id, locale: 'ru' })).status, 429)
    assert.equal((await request('/api/ai/voice', demo.token, { message_id: 'greeting', locale: 'ru' })).status, 200)
    assert.equal((await readFile(path.join(dir, 'fish-calls.log'), 'utf8')).trim().split('\n').length, count)

  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
