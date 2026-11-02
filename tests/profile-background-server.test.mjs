import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('profile background choice is authenticated, validated, public and persists', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-profile-bg-'))
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
    const alice = await register('bgalice'), bob = await register('bgbob')
    assert.equal((await req('/api/me', { method: 'PATCH', body: { profile_background: 'sakura_video' } })).status, 401)
    for (const background of ['sakura_video', 'autumn_video', 'moon_sakura', 'ember_maple', '']) {
      const result = await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: background } })
      assert.equal(result.status, 200); assert.equal(result.json.profile.profile_background, background)
      assert.equal((await req(`/api/users/${alice.profile.id}`, { token: bob.token })).json.profile.profile_background, background)
    }
    const premiumIds = ['storm_field', 'aurora_sky', 'nebula', 'ocean_night', 'fireflies', 'rain_city', 'volcano', 'snow_forest', 'lantern_lake', 'desert_night', 'underwater']
    for (const background of premiumIds) assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: background } })).status, 403)
    assert.equal((await req('/api/premium/redeem', { token: alice.token, method: 'POST', body: { code: 'NEXO-PRO-A7K9' } })).status, 200)
    for (const background of premiumIds) {
      assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: background } })).json.profile.profile_background, background)
      assert.equal((await req(`/api/users/${alice.profile.id}`, { token: bob.token })).json.profile.profile_background, background)
    }
    assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: 'https://example.test/video' } })).status, 400)
    assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: null } })).status, 400)
    await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: 'moon_sakura' } })
    await stop(); await start()
    assert.equal((await req('/api/me', { token: alice.token })).json.profile.profile_background, 'moon_sakura')
    assert.equal((await req('/api/me', { token: bob.token })).json.profile.profile_background, undefined)
    await stop()
    const dbFile = path.join(dir, 'db.json'); const db = JSON.parse(await readFile(dbFile, 'utf8'))
    db.profiles.find(p => p.id === alice.profile.id).premium_until = '2000-01-01T00:00:00.000Z'
    await writeFile(dbFile, JSON.stringify(db)); await start()
    assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: 'storm_field' } })).status, 403)
    assert.equal((await req('/api/me', { token: alice.token, method: 'PATCH', body: { profile_background: '' } })).status, 200)
  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
