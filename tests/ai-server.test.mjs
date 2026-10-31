import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
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
let child = spawn(process.execPath, ['--import', './tests/mock-openrouter.mjs', 'server/index.mjs'], {
  env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir, GIGACHAT_AUTH_KEY: 'test-key' }, stdio: ['ignore', 'pipe', 'pipe'],
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
    const alice = await register('aliceai'); const bob = await register('bobai'); const charlie = await register('charlieai')
    assert.ok(alice.token && bob.token)
    assert.equal((await request('/api/ai/status', alice.token)).json.ready, true)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'Hello' })).json.messages[1].content, 'Mock response')
    assert.equal((await request('/api/ai/history', alice.token)).json.messages.length, 2)
    assert.equal((await request('/api/ai/history', bob.token)).json.messages.length, 0)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'quota' })).json.error, 'AI_RATE_LIMIT')
    assert.equal((await request('/api/ai/history', alice.token)).json.messages.length, 2)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'forbidden' })).json.error, 'AI_FORBIDDEN')
    assert.equal((await request('/api/ai/message', alice.token, { text: 'x'.repeat(2001) })).status, 400)
    for (let i = 0; i < 9; i++) assert.equal((await request('/api/ai/message', alice.token, { text: 'ok' })).status, 200)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'over' })).json.error, 'AI_DAILY_LIMIT')
    // Failed provider responses do not consume successful replies, but attempts
    // are independently bounded so repeated failures cannot be abused.
    for (let i = 0; i < 30; i++) assert.equal((await request('/api/ai/message', charlie.token, { text: 'quota' })).json.error, 'AI_RATE_LIMIT')
    assert.equal((await request('/api/ai/message', charlie.token, { text: 'ok' })).json.error, 'AI_ATTEMPT_LIMIT')
    // New conversations stay separate and cannot be read or used by another user.
    const first = await request('/api/ai/message', bob.token, { text: 'First topic', thread_id: null })
    const second = await request('/api/ai/message', bob.token, { text: 'Second topic', thread_id: null })
    assert.equal(first.status, 200); assert.equal(second.status, 200)
    assert.notEqual(first.json.thread_id, second.json.thread_id)
    const list = await request('/api/ai/threads', bob.token)
    assert.equal(list.json.threads.length, 2)
    assert.equal((await request('/api/ai/history?thread_id=' + first.json.thread_id, bob.token)).json.messages[0].content, 'First topic')
    assert.equal((await request('/api/ai/history?thread_id=' + first.json.thread_id, alice.token)).status, 404)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'intrude', thread_id: first.json.thread_id })).status, 404)
    assert.deepEqual((await request('/api/ai/rewrite', bob.token, { text: 'hello there', action: 'correct' })).json, { text: 'Mock response' })
    for (const action of ['improve', 'shorten']) assert.deepEqual((await request('/api/ai/rewrite', bob.token, { text: 'draft', action })).json, { text: 'Mock response' })
    assert.equal((await request('/api/ai/rewrite', bob.token, { text: 'x'.repeat(2001), action: 'correct' })).status, 400)
    assert.equal((await request('/api/ai/rewrite', bob.token, { text: 'hello', action: 'unknown' })).status, 400)
    assert.equal((await request('/api/ai/rewrite', null, { text: 'hello', action: 'correct' })).status, 401)
    assert.equal((await request('/api/ai/history?thread_id=' + first.json.thread_id, bob.token)).json.messages.length, 2)
    // Simulate a pre-migration record, restart, and verify it remains accessible.
    child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit')
    const dbPath = path.join(dir, 'db.json')
    const db = JSON.parse(await readFile(dbPath, 'utf8'))
    const old = db.aiChats.find(c => c.id === first.json.thread_id)
    delete old.id; delete old.created_at
    db.aiUsage.successTotal = 40 // other accounts can exhaust the shared cap
    await writeFile(dbPath, JSON.stringify(db))
    logs = ''
    child = spawn(process.execPath, ['--import', './tests/mock-openrouter.mjs', 'server/index.mjs'], {
      env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir, GIGACHAT_AUTH_KEY: 'test-key' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', data => { logs += data.toString() })
    child.stderr.on('data', data => { logs += data.toString() })
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
      if (child.exitCode !== null) throw new Error('Restarted server exited')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.match(logs, /listening on/)
    const after = await request('/api/ai/threads', bob.token)
    const migrated = after.json.threads.find(c => c.title === 'First topic')
    assert.ok(migrated?.id)
    assert.equal((await request('/api/ai/history?thread_id=' + migrated.id, bob.token)).json.messages[0].content, 'First topic')
    assert.ok(JSON.parse(await readFile(dbPath, 'utf8')).aiChats.find(c => c.id === migrated.id))
    assert.equal((await request('/api/ai/message', bob.token, { text: 'ok' })).json.error, 'AI_SERVER_DAILY_LIMIT')
    // Upgrade legacy attempt-only data without deleting chats or discarding
    // the old abuse counter; failures must no longer look like reply limits.
    child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit')
    const legacy = JSON.parse(await readFile(dbPath, 'utf8'))
    delete legacy.aiUsage.successTotal; delete legacy.aiUsage.successUsers
    legacy.aiUsage.total = 10; legacy.aiUsage.users = { [alice.profile.id]: 10 }
    await writeFile(dbPath, JSON.stringify(legacy))
    logs = ''
    child = spawn(process.execPath, ['--import', './tests/mock-openrouter.mjs', 'server/index.mjs'], {
      env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir, GIGACHAT_AUTH_KEY: 'test-key' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', data => { logs += data.toString() }); child.stderr.on('data', data => { logs += data.toString() })
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
      if (child.exitCode !== null) throw new Error('Legacy server exited')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.match(logs, /listening on/)
    assert.equal((await request('/api/ai/message', alice.token, { text: 'quota' })).json.error, 'AI_RATE_LIMIT')
    const upgraded = JSON.parse(await readFile(dbPath, 'utf8'))
    assert.equal(upgraded.aiUsage.total, 11); assert.equal(upgraded.aiUsage.successTotal, 0)
    assert.ok(upgraded.aiChats.find(c => c.id === migrated.id))
} finally {
  child.kill('SIGTERM')
  if (child.exitCode === null) await once(child, 'exit')
  await rm(dir, { recursive: true, force: true })
 }
})
