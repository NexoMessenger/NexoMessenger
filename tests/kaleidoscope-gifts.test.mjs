import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

const keys = ['tnt-pop','mint-mug','midnight-noodles','freedom-socks','golden-stitch','velvet-ring','heart-pass','shadow-orb','dream-orb','golden-clover','flame-rocket','emerald-clover','ember-tree','jade-pup','lava-light'].map(x => `nexo-${x}`)
test('Kaleidoscope artwork, one-time stock migration, purchase and transfer survive restart', async () => {
  const assets = await readFile('src/lib/giftCatalog.ts','utf8'), client = await readFile('src/lib/giftData.ts','utf8'), sql = await readFile('supabase/migrations/017_kaleidoscope.sql','utf8')
  for (const key of keys) {
    assert.ok(client.includes(`key: '${key}'`)); assert.ok(assets.includes(`'${key}':`)); assert.ok(sql.includes(`'${key}'`))
    const bytes = await readFile(`src/assets/gifts/constellation/${key.slice(5)}.jpg`); assert.deepEqual([...bytes.subarray(0,3)], [255,216,255])
  }
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-kaleidoscope-'))
  let child, logs = ''
  const start = async () => { logs=''; child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']}); child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);for(let i=0;i<100&&!logs.includes('listening on');i++){if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,50))}assert.match(logs,/listening on/) }
  const stop=async()=>{if(child?.exitCode===null){child.kill('SIGTERM');await once(child,'exit')}}
  const req=async(url,token,body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
  try {
    await start()
    const user=(await req('/api/auth/register',null,{username:'buyer',email:'buyer@test.test',password:'secret1'})).data
    const friend=(await req('/api/auth/register',null,{username:'receiver',email:'receiver@test.test',password:'secret1'})).data
    const before=(await req('/api/gifts/market',user.token)).data.entries.filter(x=>!keys.includes(x.model.key)).map(x=>x.item.id).sort()
    await stop()
    const file=path.join(dir,'db.json'),old=JSON.parse(await readFile(file,'utf8'))
    old.gifts.items=old.gifts.items.filter(x=>!keys.includes(x.model_key));old.gifts.stocked=old.gifts.stocked.filter(x=>!keys.includes(x))
    await writeFile(file,JSON.stringify(old));await start()
    let market=(await req('/api/gifts/market',user.token)).data.entries
    assert.deepEqual(market.filter(x=>!keys.includes(x.model.key)).map(x=>x.item.id).sort(),before)
    const serials=new Set()
    for (const key of keys) {
      const items=market.filter(x=>x.model.key===key);assert.equal(items.length,4);assert.equal(items[0].model.collection,'NEXO Kaleidoscope');assert.equal(items[0].model.floor_price,1500);assert.equal(items[0].model.rarity_model,0);assert.equal(items[0].model.total_supply,0)
      for(const x of items){assert.ok(!serials.has(x.item.serial));serials.add(x.item.serial)}
    }
    const item=market.find(x=>x.model.key===keys[0]).item
    assert.equal((await req('/api/gifts/buy',user.token,{itemId:item.id})).status,402)
    assert.equal((await req('/api/gifts/redeem',user.token,{code:'NEXO-GIFT-X2QR'})).status,200)
    assert.equal((await req('/api/gifts/buy',user.token,{itemId:item.id})).status,200)
    const transferred=await req('/api/gifts/transfer',user.token,{itemId:item.id,toUserId:friend.profile.id})
    assert.equal(transferred.status,200);assert.equal(transferred.data.fee,25)
    await stop();await start()
    market=(await req('/api/gifts/market',user.token)).data.entries
    assert.equal(market.filter(x=>x.model.key===keys[0]).length,3)
    const inventory=(await req(`/api/users/${friend.profile.id}/collectibles`,user.token)).data.items
    assert.ok(inventory.some(x=>x.item.id===item.id))
    const messages=(await req(`/api/chats/${transferred.data.conversationId}/messages`,friend.token)).data.messages
    assert.equal(messages.at(-1).attachment_type,'gift/nft-transfer')
  } finally { await stop();await rm(dir,{recursive:true,force:true}) }
})
