import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('new gift backfills existing data once and buying preserves ownership and balance', async () => {
  const listener = net.createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-vampire-test-'))
  const base = `http://127.0.0.1:${port}`
  let child, logs = ''
  const start = async () => {
    logs = ''
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', data => { logs += data })
    child.stderr.on('data', data => { logs += data })
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
      if (child.exitCode !== null) throw new Error(logs)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.match(logs, /listening on/)
  }
  const stop = async () => { if (!child || child.exitCode !== null) return; child.kill('SIGTERM'); await once(child, 'exit') }
  const request = async (url, token, body) => {
    const res = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, data: await res.json() }
  }
  try {
    await start()
    const registered = await request('/api/auth/register', null, { email: 'buyer@example.test', username: 'testbuyer', displayName: 'Test', password: 'secret1' })
    assert.equal(registered.status, 200)
    const token = registered.data.token
    assert.equal((await request('/api/gifts/state', token)).data.balance, 1000)
    await stop()
    // Mimic an existing install from before the new model was added.
    const dbPath = path.join(dir, 'db.json')
    const db = JSON.parse(await readFile(dbPath, 'utf8'))
    db.gifts.items = db.gifts.items.filter(item => item.model_key !== 'nexo-vampire-kiss')
    db.gifts.stocked = db.gifts.stocked.filter(key => key !== 'nexo-vampire-kiss')
    await writeFile(dbPath, JSON.stringify(db))
    await start()
    let market = (await request('/api/gifts/market', token)).data.entries.filter(e => e.model.key === 'nexo-vampire-kiss')
    assert.equal(market.length, 4)
    assert.equal(market[0].price, 2800)
    assert.equal(market[0].model.rarity_model, 0)
    const id = market[0].item.id
    assert.equal((await request('/api/gifts/buy', token, { itemId: id })).status, 402)
    assert.equal((await request('/api/gifts/redeem', token, { code: 'NEXO-MEGA-K7Q2' })).status, 200)
    const bought = await request('/api/gifts/buy', token, { itemId: id })
    assert.equal(bought.status, 200); assert.equal(bought.data.balance, 8200)
    assert.ok((await request('/api/gifts/state', token)).data.myItems.some(g => g.item.id === id))
    await stop(); await start()
    market = (await request('/api/gifts/market', token)).data.entries.filter(e => e.model.key === 'nexo-vampire-kiss')
    assert.equal(market.length, 3)
    const state = (await request('/api/gifts/state', token)).data
    assert.equal(state.balance, 8200); assert.ok(state.myItems.some(g => g.item.id === id))
  } finally { await stop(); await rm(dir, { recursive: true, force: true }) }
})
