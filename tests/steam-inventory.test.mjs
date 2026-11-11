import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
import { parseTradeUrl, tradeKey, encryptTrade, decryptTrade, fetchInventory } from '../server/steam-inventory.mjs'

test('trade URLs validate exact official destination and encryption is owner-bound',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'steam-key-'))
 try{const url='https://steamcommunity.com/tradeoffer/new/?partner=123456&token=abc_DEF1';const parsed=parseTradeUrl(url);assert.equal(parsed.steamId,'76561197960389184');for(const bad of ['https://steamcommunity.com.evil.test/tradeoffer/new/?partner=1&token=abc_DEF1','http://steamcommunity.com/tradeoffer/new/?partner=1&token=abc_DEF1','https://steamcommunity.com/tradeoffer/new/?partner=1&token=x','https://steamcommunity.com/tradeoffer/new/?partner=1&token=abc_DEF1&token=abc_DEF2'])assert.throws(()=>parseTradeUrl(bad));const key=tradeKey(dir,false);assert.equal((await stat(path.join(dir,'steam-trade-key'))).mode&0o777,0o600);const encrypted=encryptTrade(url,key,'owner');assert.equal(decryptTrade(encrypted,key,'owner'),url);assert.throws(()=>decryptTrade(encrypted,key,'other'));assert.ok(!JSON.stringify(encrypted).includes('abc_DEF1'))}finally{await rm(dir,{recursive:true,force:true})}
})
test('inventory maps paginated public Steam assets and only requests allowed games',async()=>{
 const mock=async(url,options)=>{assert.match(url,/^https:\/\/steamcommunity\.com\/inventory\/76561197960389184\/730\/2\?/);assert.equal(options.redirect,'error');return new Response(JSON.stringify({success:1,total_inventory_count:2,more_items:1,last_assetid:'44',assets:[{assetid:'44',classid:'2',instanceid:'0',amount:'1'}],descriptions:[{classid:'2',instanceid:'0',name:'Test item',icon_url:'abc_DEF'}]}))}
 const result=await fetchInventory('76561197960389184',730,'','ru',mock);assert.equal(result.items[0].name,'Test item');assert.equal(result.next,'44');assert.match(result.items[0].icon,/^https:\/\/community\.cloudflare\.steamstatic\.com/);await assert.rejects(fetchInventory('76561197960389184',999,'','en',mock),/INVALID_INVENTORY_REQUEST/);await assert.rejects(fetchInventory('76561197960389184',730,'evil','en',mock),/INVALID_INVENTORY_REQUEST/);await assert.rejects(fetchInventory('76561197960389184',730,'','en',async()=>new Response('',{status:403})),/INVENTORY_PRIVATE/)
})
test('Steam link is encrypted, private per account, persisted and removable',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'steam-api-'));const listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));let child
 const start=async()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);for(let i=0;i<100&&!output.includes('listening on');i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,50))}assert.match(output,/listening on/)};const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 const req=async(url,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 try {await start();const reg=async name=>(await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'})).data;const a=await reg('steamowner'),b=await reg('steamother');assert.equal((await req('/api/gaming/steam')).status,401);assert.equal((await req('/api/gaming/steam',a.token,'PUT',{tradeUrl:'https://evil.com'})).status,400);const link='https://steamcommunity.com/tradeoffer/new/?partner=123456&token=abc_DEF1';assert.equal((await req('/api/gaming/steam',a.token,'PUT',{tradeUrl:link})).status,200);assert.ok(!(await readFile(path.join(dir,'db.json'),'utf8')).includes('abc_DEF1'));assert.equal((await req('/api/gaming/steam',b.token)).data.connected,false);assert.equal((await req('/api/gaming/steam/inventory?appid=999',b.token)).status,400);await stop();await start();const saved=await req('/api/gaming/steam',a.token);assert.equal(saved.data.steamId,'76561197960389184');assert.ok(!JSON.stringify(saved).includes('abc_DEF1'));assert.equal((await req('/api/gaming/steam',a.token,'DELETE')).status,200);assert.equal((await req('/api/gaming/steam',a.token)).data.connected,false)
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
})
