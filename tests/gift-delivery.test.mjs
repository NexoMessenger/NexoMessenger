import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('ordinary gifts preserve distinct comments and anonymity, NFT transfer notifies atomically', async () => {
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(r => listener.close(r))
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-gift-delivery-'))
  let child, logs = ''
  const start = async () => { logs = ''; child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b); for (let i = 0; i < 100 && !logs.includes('listening on'); i++) { if (child.exitCode !== null) throw Error(logs); await new Promise(r => setTimeout(r, 50)) } assert.match(logs, /listening on/) }
  const stop = async () => { if (child?.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') } }
  const req = async (url, token, body, method) => { const response = await fetch(`http://127.0.0.1:${port}${url}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, data: await response.json() } }
  try {
    await start()
    const alice = (await req('/api/auth/register', null, { username: 'alice', displayName: 'Alice', email: 'alice@test.test', password: '123456' })).data
    const bob = (await req('/api/auth/register', null, { username: 'bob', email: 'bob@test.test', password: '123456' })).data
    const eve = (await req('/api/auth/register', null, { username: 'eve', email: 'eve@test.test', password: '123456' })).data
    for (let i=0;i<2;i++) assert.equal((await req('/api/gifts/buy-regular', alice.token, { giftKey:'ruby-rose' })).status, 200)
    // Upgrade from old data, with no instance data. Count is preserved.
    await stop(); const file = path.join(dir,'db.json'); const old = JSON.parse(await readFile(file,'utf8')); delete old.gifts.regularItems; await writeFile(file, JSON.stringify(old)); await start()
    let showcase = (await req(`/api/users/${alice.profile.id}/collectibles`, eve.token)).data.regular
    assert.equal(showcase.length, 2); assert.notEqual(showcase[0].gift.id, showcase[1].gift.id)
    const first = await req('/api/gifts/send-regular', alice.token, { giftKey:'ruby-rose', toUserId:bob.profile.id, comment:'Hello! 🌹', anonymous:false })
    const second = await req('/api/gifts/send-regular', alice.token, { giftKey:'ruby-rose', toUserId:bob.profile.id, comment:'Secret', anonymous:true })
    assert.equal(first.status,200); assert.equal(second.status,200); assert.equal(first.data.conversationId,second.data.conversationId)
    const chat = first.data.conversationId
    assert.equal((await req(`/api/chats/${chat}/messages`, eve.token)).status, 403)
    const messages = (await req(`/api/chats/${chat}/messages`, bob.token)).data.messages
    assert.equal(messages.length,2); assert.equal(messages[0].gift_data.comment,'Hello! 🌹'); assert.equal(messages[0].gift_data.sender_name,'Alice (@alice)'); assert.equal(messages[0].gift_data.price,25)
    assert.equal(messages[1].gift_data.anonymous,true); assert.equal(messages[1].gift_data.sender_name,''); assert.equal(messages[1].gift_data.comment,'Secret')
    const deniedEdit = await req(`/api/chats/${chat}/messages/${messages[0].id}`, alice.token, { body:'fake' }, 'PATCH'); assert.equal(deniedEdit.status,400)
    const forged = await req(`/api/chats/${chat}/messages`, alice.token, { body:'fake', attachment:{type:'gift/nexo',url:'ruby-rose'} }); assert.equal(forged.status,400)
    showcase = (await req(`/api/users/${bob.profile.id}/collectibles`, eve.token)).data.regular
    assert.equal(showcase.length,2); assert.equal(showcase[0].gift.comment,'Hello! 🌹'); assert.equal(showcase[1].gift.comment,'Secret'); assert.equal(showcase[1].gift.sender_name,''); assert.ok(!JSON.stringify(showcase[1]).includes(alice.profile.id))
    assert.equal((await req('/api/gifts/send-regular', alice.token, { giftKey:'ruby-rose',toUserId:bob.profile.id })).status,400)
    assert.equal((await req('/api/gifts/send-regular', bob.token, { giftKey:'ruby-rose',toUserId:alice.profile.id,comment:'x'.repeat(301) })).status,400)
    // Sell the specifically selected copy; the other copy is untouched.
    assert.equal((await req('/api/gifts/sell-regular', bob.token, { giftKey:'ruby-rose',itemId:showcase[0].gift.id })).status,200)
    assert.equal((await req('/api/gifts/sell-regular', bob.token, { giftKey:'ruby-rose',itemId:showcase[0].gift.id })).status,404)
    showcase = (await req(`/api/users/${bob.profile.id}/collectibles`, eve.token)).data.regular
    assert.equal(showcase.length,1); assert.equal(showcase[0].gift.comment,'Secret')
    const market = (await req('/api/gifts/market', alice.token)).data.entries
    const nft = market.find(x => x.model.key === 'honey-bear')
    assert.equal((await req('/api/gifts/buy',alice.token,{itemId:nft.item.id})).status,200)
    const balance = (await req('/api/gifts/state',alice.token)).data.balance
    const transfer = await req('/api/gifts/transfer',alice.token,{itemId:nft.item.id,toUserId:bob.profile.id})
    assert.equal(transfer.status,200); assert.equal(transfer.data.fee,25); assert.equal(transfer.data.balance,balance-25)
    const msg = (await req(`/api/chats/${chat}/messages`,bob.token)).data.messages.at(-1)
    assert.equal(msg.attachment_type,'gift/nft-transfer'); assert.equal(msg.gift_data.fee,25); assert.equal(msg.attachment_url,nft.item.id)
    assert.equal((await req('/api/gifts/transfer',alice.token,{itemId:nft.item.id,toUserId:bob.profile.id})).status,403)
    await stop(); const saved = JSON.parse(await readFile(file,'utf8')); saved.gifts.wallets[bob.profile.id].balance = 0; await writeFile(file, JSON.stringify(saved)); await start()
    assert.equal((await req('/api/gifts/transfer',bob.token,{itemId:nft.item.id,toUserId:alice.profile.id})).status,402)
    showcase = (await req(`/api/users/${bob.profile.id}/collectibles`,eve.token)).data
    assert.equal(showcase.regular[0].gift.comment,'Secret'); assert.ok(showcase.items.some(x=>x.item.id===nft.item.id))
    assert.equal((await req(`/api/chats/${chat}/messages`,bob.token)).data.messages.length,3)
  } finally { await stop(); await rm(dir,{recursive:true,force:true}) }
})
