import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('gaming communities persist, support discussions and enforce moderation', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-gaming-'));const server=net.createServer().listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));let child
 const start=async()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);for(let i=0;i<100&&!output.includes('listening on');i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,50))}assert.match(output,/listening on/)}
 const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 const req=async(url,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 try {await start();const reg=async name=>(await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'})).data
 const a=await reg('gameowner'),b=await reg('gameguest'),c=await reg('gameother');assert.equal((await req('/api/gaming/communities')).status,401)
 const games=(await req('/api/gaming/catalog',a.token)).data.games;assert.equal(games.length,101);assert.equal(new Set(games.map(g=>g.steam_app_id)).size,101); assert.deepEqual(games[0],{id:'rust',name:'Rust',steam_app_id:252490,url:'https://store.steampowered.com/app/252490/',image_url:'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg'});assert.ok(games.every(g=>g.url === `https://store.steampowered.com/app/${g.steam_app_id}/` && g.image_url === `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.steam_app_id}/header.jpg`));assert.equal((await req('/api/gaming/activity',a.token,'POST',{game_id:'fake',url:'https://example.com'})).status,400)
 assert.equal((await req('/api/gaming/communities',a.token,'POST',{name:'   '})).status,400)
 const community=(await req('/api/gaming/communities',a.token,'POST',{name:'Players',description:'hello'})).data.community
 assert.equal((await req('/api/gaming/communities',b.token)).data.communities[0].name,'Players')
 const route=`/api/gaming/communities/${community.id}`
 assert.equal((await req(route+'/topics',b.token,'POST',{title:'',body:'text'})).status,400)
 const topic=(await req(route+'/topics',b.token,'POST',{title:'First',body:'Welcome'})).data.topic
 const tr=`/api/gaming/topics/${topic.id}`
 const reply=(await req(tr+'/replies',c.token,'POST',{body:'Hello'})).data.reply
 assert.equal((await req(route,a.token)).data.topics[0].reply_count,1)
 assert.equal((await req(tr+'/replies/'+reply.id,b.token,'DELETE')).status,403)
 assert.equal((await req(tr,b.token)).data.replies[0].body,'Hello')
 await stop();await start();assert.equal((await req(tr,a.token)).data.topic.title,'First')
 assert.equal((await req(tr+'/replies/'+reply.id,a.token,'DELETE')).status,200)
 assert.equal((await req(tr,c.token,'DELETE')).status,403);assert.equal((await req(tr,a.token,'DELETE')).status,200);assert.equal((await req(tr,b.token)).status,404)
 assert.equal((await req('/api/gaming/activity/'+a.profile.id,b.token)).data.activity,null)
 assert.equal((await req('/api/gaming/activity',a.token,'POST',{game_id:'rust'})).status,200)
 assert.equal((await req('/api/gaming/activity/'+a.profile.id,b.token)).data.activity.name,'Rust')
 assert.equal((await req('/api/gaming/activity',a.token,'DELETE')).status,200)
 assert.equal((await req('/api/gaming/activity/'+a.profile.id,b.token)).data.activity,null)
 } finally {if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
})
