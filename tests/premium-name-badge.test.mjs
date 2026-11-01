import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('name badge requires Premium, persists, is public and can be removed after expiry', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-name-badge-'))
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`
  let child
  const start = async () => {
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    for (let i = 0; i < 100 && !output.includes('listening on'); i++) { if (child.exitCode !== null) throw new Error(output); await new Promise(r => setTimeout(r, 50)) }
    assert.match(output, /listening on/)
  }
  const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
  const req = async (url, { token, method = 'GET', body } = {}) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, json: await res.json() }
  }
  try {
    await start()
    const register = async n => (await req('/api/auth/register', { method: 'POST', body: { email: `${n}@example.test`, password: 'secret1', username: n, displayName: n } })).json
    const alice = await register('badgealice'), bob = await register('badgebob')
    const put = (token, body) => req('/api/premium/decor', { token, method: 'PUT', body })
    assert.equal((await put(undefined, { nameBadge: 'autumn' })).status, 401)
    for (const nameBadge of ['autumn', 'clover', 'sakura']) assert.equal((await put(alice.token, { nameBadge })).status, 403)
    assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { name_badge: 'autumn', premium_until: '2099-01-01' } })).json.profile.name_badge, undefined)
    assert.equal((await req('/api/premium/redeem', { token: alice.token, method: 'POST', body: { code: 'NEXO-PRO-A7K9' } })).status, 200)
    assert.equal((await put(alice.token, { nameBadge: 'bogus' })).status, 400)
    for (const nameBadge of ['autumn', 'clover', 'sakura']) {
      assert.equal((await put(alice.token, { nameBadge })).json.profile.name_badge, nameBadge)
      assert.equal((await req(`/api/users/${alice.profile.id}`, { token: bob.token })).json.profile.name_badge, nameBadge)
      await stop(); await start()
      assert.equal((await req('/api/me', { token: alice.token })).json.profile.name_badge, nameBadge)
    }
    await stop()
    const dbFile = path.join(dir, 'db.json'); const db = JSON.parse(await readFile(dbFile, 'utf8'))
    db.profiles.find(p => p.id === alice.profile.id).premium_until = '2000-01-01T00:00:00.000Z'
    await writeFile(dbFile, JSON.stringify(db)); await start()
    for (const nameBadge of ['autumn', 'clover', 'sakura']) assert.equal((await put(alice.token, { nameBadge })).status, 403)
    assert.equal((await put(alice.token, { nameBadge: '' })).json.profile.name_badge, '')
  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
