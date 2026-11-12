import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {once} from 'node:events'

test('squads have real members, enforce capacity, moderation and expiry, and persist',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-squads-'));const server=net.createServer().listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));let child
 const start=async()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);for(let i=0;i<100&&!out.includes('listening on');i++){if(child.exitCode!==null)throw Error(out);await new Promise(r=>setTimeout(r,50))}assert.match(out,/listening on/)}
 const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 const req=async(url,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 try {await start();const reg=async name=>(await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'})).data
  const a=await reg('squadalpha'),b=await reg('squadbeta'),c=await reg('squadgamma');const world='/api/gaming/communities/nexo-world-rust/squads'
  assert.equal((await req(world)).status,401);assert.deepEqual((await req(world,a.token)).data.squads,[])
  assert.equal((await req(world,a.token,'POST',{title:'A',platform:'pc',capacity:9})).status,400)
  assert.equal((await req(world,a.token,'POST',{title:'  ',platform:'pc',capacity:2})).status,400)
  assert.equal((await req(world,a.token,'POST',{title:'A',platform:'pc',capacity:2,language:'xx'})).status,400)
  assert.equal((await req(world,a.token,'POST',{title:'A',platform:'pc',capacity:2,starts_at:new Date(Date.now()-60000).toISOString()})).status,400)
  const starts_at=new Date(Date.now()+3600000).toISOString()
  const squad=(await req(world,a.token,'POST',{title:'Raid',note:'Friendly',platform:'pc',capacity:2,starts_at,language:'ru',style:'casual'})).data.squad
  assert.equal(squad.language,'ru');assert.equal(squad.style,'casual');assert.equal(squad.starts_at,Date.parse(starts_at))
  assert.equal((await req('/api/gaming/squads/mine')).status,401)
  assert.equal((await req('/api/gaming/squads/mine',a.token)).data.squads[0].community_name,'Rust')
  assert.equal((await req('/api/gaming/squads/mine',c.token)).data.squads.length,0)
  const data={title:'Updated',note:'New',platform:'cross',capacity:3,starts_at,language:'uk',style:'training'}
  assert.equal((await req(`/api/gaming/squads/${squad.id}`,b.token,'PUT',data)).status,403)
  const updated=await req(`/api/gaming/squads/${squad.id}`,a.token,'PUT',data);assert.equal(updated.status,200);assert.equal(updated.data.squad.style,'training');assert.equal(updated.data.squad.title,'Updated')
  assert.equal((await req(`/api/gaming/squads/${squad.id}`,a.token,'PUT',{...data,style:'fake'})).status,400)
  assert.equal((await req(`/api/gaming/squads/${squad.id}`,a.token,'PUT',{...data,capacity:2})).status,200)
  assert.equal(squad.members.length,1);assert.equal(squad.joined,true);assert.equal(squad.members[0].id,a.profile.id);assert.equal(squad.members[0].email,undefined)
  const join=`/api/gaming/squads/${squad.id}/join`, del=`/api/gaming/squads/${squad.id}`
  assert.equal((await req(join,a.token,'DELETE')).status,400)
  assert.equal((await req(join,b.token,'PUT')).data.squad.members.length,2);assert.equal((await req(join,b.token,'PUT')).data.squad.members.length,2)
  assert.equal((await req(`/api/gaming/squads/${squad.id}`,a.token,'PUT',{...data,capacity:1})).status,400);
  assert.equal((await req(join,c.token,'PUT')).status,409);assert.equal((await req(del,c.token,'DELETE')).status,403)
  await stop();await start();assert.equal((await req(world,b.token)).data.squads[0].joined,true);assert.equal((await req(world,b.token)).data.squads[0].language,'uk');assert.equal((await req('/api/gaming/squads/mine',b.token)).data.squads.length,1)
  assert.equal((await req(join,b.token,'DELETE')).data.squad.members.length,1);assert.equal((await req(join,c.token,'PUT')).data.squad.members.length,2)
  assert.equal((await req(del,a.token,'DELETE')).status,200);assert.equal((await req(join,c.token,'PUT')).status,404)
  const newOne=(await req(world,a.token,'POST',{title:'Expiry',platform:'mobile',capacity:4})).data.squad
  await stop();const dbPath=path.join(dir,'db.json'), db=JSON.parse(await readFile(dbPath,'utf8'));db.gameSquads.find(s=>s.id===newOne.id).expires_at=Date.now()-1;await writeFile(dbPath,JSON.stringify(db));await start()
  assert.deepEqual((await req(world,a.token)).data.squads,[]);assert.equal((await req(`/api/gaming/squads/${newOne.id}/join`,b.token,'PUT')).status,404)
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
})
