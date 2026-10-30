import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

const listener = net.createServer().listen(0, '127.0.0.1')
await once(listener, 'listening')
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const dir = await mkdtemp(path.join(tmpdir(), 'nexo-ai-test-'))
const base = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['--import', './tests/mock-openrouter.mjs', 'server/index.mjs'], {
  env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir, OPENROUTER_API_KEY: 'test-key' }, stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
child.stdout.on('data', data => { logs += data.toString() })
child.stderr.on('data', data => { logs += data.toString() })
async function request(url, token, body) {
  const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: res.status, json: await res.json() }
}
test('authenticated, private AI conversations and quota failures', async () => {
 try {
  for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
    if (child.exitCode !== null) throw new Error('Test server exited')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (!logs.includes('listening on')) throw new Error('Test server did not start')
    assert.equal((await request('/api/ai/history')).status, 401)
    const register = async name => (await request('/api/auth/register', null, { email: `${name}@example.test`, password: 'secret1', username: name, displayName: name })).json
    const alice = await register('aliceai'); const bob = await register('bobai')
    assert.ok(alice.token && bob.token)
    assert.equal((await request('/api/ai/status', alice.token)).json.ready, true)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'Hello' })).json.messages[1].content, 'Mock response')
    assert.equal((await request('/api/ai/history', alice.token)).json.messages.length, 2)
    assert.equal((await request('/api/ai/history', bob.token)).json.messages.length, 0)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'quota' })).json.error, 'AI_RATE_LIMIT')
    assert.equal((await request('/api/ai/history', alice.token)).json.messages.length, 2)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'x'.repeat(2001) })).status, 400)
} finally {
  child.kill('SIGTERM')
  if (child.exitCode === null) await once(child, 'exit')
  await rm(dir, { recursive: true, force: true })
 }
})
