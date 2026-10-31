import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
const names=['moon-witch','pilot-pup','dart-champion','frost-witch','tropical-treat','candy-stocking','matcha-scoop','hazard-doll','disco-pup','matcha-bowl','golden-brew','cocoa-cone','sunflower-glow','crimson-crane','golden-serpent','neon-serpent','frost-serpent','butterfly-glow','pixel-pop','star-loupe','spiral-pop','kiwi-pop','ruby-fuzz','cosmic-loupe','starlight-scoop','frog-box','geo-forest','geo-berry','geo-ocean','rose-cap','rose-peach','amber-peach','rainbow-cap','spectrum-peach']
const keys=names.map(x=>`nexo-${x}`)
test('new visible gifts preserve stock, purchases, regular delivery, and existing data', async () => {
 const client=await readFile('src/lib/giftData.ts','utf8'),assets=await readFile('src/lib/giftCatalog.ts','utf8'),sql=await readFile('supabase/migrations/018_kaleidoscope_extra.sql','utf8')
 for(const name of [...names,'party-bear']) {const key=`nexo-${name}`;assert.ok(client.includes(`key: '${key}'`));assert.ok(assets.includes(`'${key}':`));assert.ok(sql.includes(`'${key}'`));assert.deepEqual([...((await readFile(`src/assets/gifts/kaleidoscope-extra/${name}.jpg`)).subarray(0,3))],[255,216,255])}
 const listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));const dir=await mkdtemp(path.join(tmpdir(),'nexo-kaleido-extra-'));let child,logs=''
 const start=async()=>{logs='';child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<100&&!logs.includes('listening on');i++){if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,50))}assert.match(logs,/listening on/)}
 const stop=async()=>{if(child?.exitCode===null){child.kill('SIGTERM');await once(child,'exit')}}
 const req=async(url,token,body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
 try {
  await start();const alice=(await req('/api/auth/register',null,{username:'alice',email:'alice@test.test',password:'secret1'})).data;const bob=(await req('/api/auth/register',null,{username:'bob',email:'bob@test.test',password:'secret1'})).data
  const prior=(await req('/api/gifts/market',alice.token)).data.entries.filter(x=>!keys.includes(x.model.key)).map(x=>x.item.id).sort()
  await stop();const file=path.join(dir,'db.json'),db=JSON.parse(await readFile(file,'utf8'));db.gifts.items=db.gifts.items.filter(x=>!keys.includes(x.model_key));db.gifts.stocked=db.gifts.stocked.filter(x=>!keys.includes(x));await writeFile(file,JSON.stringify(db));await start()
  let entries=(await req('/api/gifts/market',alice.token)).data.entries
  assert.deepEqual(entries.filter(x=>!keys.includes(x.model.key)).map(x=>x.item.id).sort(),prior)
  const serials=new Set(entries.map(x=>x.item.serial));assert.equal(serials.size,entries.length)
  for(const key of keys){const items=entries.filter(x=>x.model.key===key);assert.equal(items.length,4);assert.equal(items[0].model.collection,'NEXO Kaleidoscope');assert.equal(items[0].price,1500);assert.equal(items[0].model.rarity_model,0);assert.equal(items[0].model.total_supply,0)}
  assert.equal((await req('/api/gifts/buy-regular',alice.token,{giftKey:'nexo-party-bear'})).status,200)
  const sent=await req('/api/gifts/send-regular',alice.token,{giftKey:'nexo-party-bear',toUserId:bob.profile.id,comment:'Happy birthday',anonymous:true});assert.equal(sent.status,200)
  assert.equal((await req(`/api/chats/${sent.data.conversationId}/messages`,bob.token)).data.messages.at(-1).gift_data.comment,'Happy birthday')
  const item=entries.find(x=>x.model.key===keys[0]).item;assert.equal((await req('/api/gifts/buy',alice.token,{itemId:item.id})).status,402)
  assert.equal((await req('/api/gifts/redeem',alice.token,{code:'NEXO-GIFT-X2QR'})).status,200);assert.equal((await req('/api/gifts/buy',alice.token,{itemId:item.id})).status,200)
  await stop();await start();entries=(await req('/api/gifts/market',alice.token)).data.entries;assert.equal(entries.filter(x=>x.model.key===keys[0]).length,3)
  assert.ok((await req(`/api/users/${alice.profile.id}/collectibles`,alice.token)).data.items.some(x=>x.item.id===item.id))
  const gifts=(await req(`/api/users/${bob.profile.id}/collectibles`,alice.token)).data.regular;assert.equal(gifts.find(x=>x.model.key==='nexo-party-bear').gift.comment,'Happy birthday');assert.equal(gifts.find(x=>x.model.key==='nexo-party-bear').gift.sender_name,'')
 } finally {await stop();await rm(dir,{recursive:true,force:true})}
})
