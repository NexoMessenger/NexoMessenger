import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('Zeron bot: bound account, private single-use codes, daily limits, restart and channel seed', async () => {
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-zeron-test-'))
  let child, logs = ''
  const start = async (env = {}) => {
    logs = ''; child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', data => { logs += data }); child.stderr.on('data', data => { logs += data })
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) { if (child.exitCode !== null) throw Error(logs); await new Promise(r => setTimeout(r, 50)) }
    assert.match(logs, /listening on/)
  }
  const stop = async () => { if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') } }
  const req = async (url, token, body, method) => {
    const res = await fetch(`http://127.0.0.1:${port}${url}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, data: await res.json() }
  }
  const action = (token, action) => req('/api/zeron/action', token, { action })
  const setup = async (token, product) => {
    assert.equal((await action(token, product.startsWith('nex_') ? 'nex' : 'premium')).status, 200)
    assert.equal((await action(token, product)).status, 200)
    assert.equal((await action(token, 'sbp')).status, 200)
  }
  try {
    await start()
    assert.equal((await req('/api/zeron/chat')).status, 401)
    const wallet = await req('/api/auth/register', null, { email: 'owner@example.test', username: 'wallet', password: 'secret1' })
    const other = await req('/api/auth/register', null, { email: 'other@example.test', username: 'other', password: 'secret1' })
    const w = wallet.data.token, o = other.data.token
    await stop(); await start()
    // A later registration named wallet must never gain access by a restart.
    assert.equal((await req('/api/zeron/chat', w)).data.canIssue, false)
    await setup(w, 'nex_100'); assert.equal((await action(w, 'continue')).status, 403)
    await stop()
    // Emulate the original existing account at upgrade time.
    const dbPath = path.join(dir, 'db.json'), db = JSON.parse(await readFile(dbPath, 'utf8'))
    delete db.zeronOwnerInitialized; await writeFile(dbPath, JSON.stringify(db))
    await start()
    assert.equal((await req('/api/zeron/chat', w)).data.canIssue, true)
    assert.equal((await req('/api/channels/c_zeron_official/posts', o)).data.posts.length, 3)
    const members = (await req('/api/channels/c_zeron_official/members', w)).data.members
    assert.equal(members.find(m => m.profile.id === wallet.data.profile.id).role, 'admin')
    assert.equal((await req('/api/channels/c_zeron_official/posts', w, { body: 'A real announcement' })).status, 200)
    await setup(o, 'nex_5000'); assert.equal((await action(o, 'continue')).status, 403)
    assert.equal((await action(o, 'bogus')).status, 400)
    const balanceBefore = (await req('/api/gifts/state', w)).data.balance
    const codes = []
    for (const [product, amount] of [['nex_100',100], ['nex_500',500], ['nex_1000',1000], ['nex_5000',5000], ['premium_30',30]]) {
      await setup(w, product)
      // Concurrent requests cannot issue two codes for one option.
      const results = await Promise.all([action(w, 'continue'), action(w, 'continue')])
      const issued = results.filter(r => r.status === 200); assert.equal(issued.length, 1)
      const code = issued[0].data.messages.at(-1).code; assert.match(code, /^NEXO-TEST-[A-F0-9]{24}$/); codes.push(code)
      const endpoint = product === 'premium_30' ? '/api/premium/redeem' : '/api/gifts/redeem'
      assert.equal((await req(endpoint, o, { code })).status, 403)
      const redeemed = await req(endpoint, w, { code }); assert.equal(redeemed.status, 200)
      assert.equal(product === 'premium_30' ? redeemed.data.days : redeemed.data.amount, amount)
      assert.equal((await req(endpoint, w, { code })).status, 409)
      await setup(w, product); assert.equal((await action(w, 'continue')).data.error, 'ZERON_DAILY_LIMIT')
    }
    assert.equal(new Set(codes).size, 5)
    assert.equal((await req('/api/gifts/state', w)).data.balance, balanceBefore + 6600)
    assert.ok((await req('/api/premium/me', w)).data.active)
    // Reassigning the username cannot move the privileges to another account.
    assert.equal((await req('/api/me', w, { username: 'oldwallet' }, 'PATCH')).status, 200)
    assert.equal((await req('/api/me', o, { username: 'wallet' }, 'PATCH')).status, 200)
    await stop(); await start()
    assert.equal((await req('/api/zeron/chat', w)).data.canIssue, true)
    assert.equal((await req('/api/zeron/chat', o)).data.canIssue, false)
    assert.equal((await req('/api/channels/c_zeron_official/posts', o)).data.posts.length, 4)
    assert.equal((await action(w, 'continue')).data.error, 'ZERON_DAILY_LIMIT')
    assert.equal((await req('/api/zeron/chat', w)).data.messages.some(m => m.code === codes[0]), true)
    assert.equal((await req('/api/zeron/chat', o)).data.messages.some(m => m.code), false)
    await stop(); await start({ ZERON_TEST_CODES_ENABLED: 'false' })
    assert.equal((await req('/api/zeron/chat', w)).data.canIssue, false)
    assert.equal((await action(w, 'continue')).status, 403)
  } finally { await stop(); await rm(dir, { recursive: true, force: true }) }
})
