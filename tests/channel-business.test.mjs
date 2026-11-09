import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('business details are owner-controlled, validated, private when needed, and persist', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'nexo-business-'))
 const listener = net.createServer().listen(0,'127.0.0.1'); await once(listener,'listening'); const port=listener.address().port; await new Promise(r=>listener.close(r)); let child
 const start=async()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);for(let i=0;i<100&&!output.includes('listening on');i++){if(child.exitCode!==null) throw Error(output);await new Promise(r=>setTimeout(r,50))}assert.match(output,/listening on/)}
 const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 const req=async(url,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 try {
  await start(); const reg=async name=>(await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'})).data
  const owner=await reg('ownerbusiness'),other=await reg('guestbusiness')
  const id=(await req('/api/channels',owner.token,'POST',{name:'Coffee',description:'Local',isPublic:true})).data.id
  const route=`/api/channels/${id}/business`, details={enabled:true,website:'https://example.com/shop',address:'Main street',hours:'Mon–Fri 9–17'}
  assert.equal((await req(route,other.token,'PUT',details)).status,403)
  assert.equal((await req(route,owner.token,'PUT',{...details,website:'javascript:alert(1)'})).status,400)
  assert.equal((await req(route,owner.token,'PUT',{...details,website:'https://name:password@example.com'})).status,400)
  assert.equal((await req(route,owner.token,'PUT',details)).status,200)
  assert.deepEqual((await req(`/api/channels/${id}`,other.token)).data.channel.business,details)
  const privateId=(await req('/api/channels',owner.token,'POST',{name:'Private',isPublic:false})).data.id
  assert.equal((await req(`/api/channels/${privateId}/business`,owner.token,'PUT',details)).status,200)
  assert.equal((await req(`/api/channels/${privateId}`,other.token)).status,404)
  await stop();await start();assert.deepEqual((await req(`/api/channels/${id}`,owner.token)).data.channel.business,details)
  assert.deepEqual((await req(route,owner.token,'PUT',{...details,enabled:false})).data.channel.business,{enabled:false,website:'',address:'',hours:''})
 } finally {if(child?.exitCode===null)await stop(); await rm(dir,{recursive:true,force:true})}
})
