import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('stories are private to direct chat participants, expire, delete and survive restarts', async () => {
 const dir = await mkdtemp(path.join(tmpdir(),'nexo-stories-'))
 const listener = net.createServer().listen(0,'127.0.0.1'); await once(listener,'listening'); const port=listener.address().port; await new Promise(r=>listener.close(r)); let child
 const start=async()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);for(let i=0;i<100&&!out.includes('listening on');i++){if(child.exitCode!==null)throw Error(out);await new Promise(r=>setTimeout(r,50))}assert.match(out,/listening on/)}
 const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 const req=async(url,token,method='GET',body)=>fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const json=async(r)=>r.json()
 try {
  await start(); const reg=async name=>json(await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'}))
  const a=await reg('storyauthor'), b=await reg('storyfriend'), c=await reg('storystranger')
  const media=Buffer.from('89504e470d0a1a0a00000000','hex').toString('base64')
  assert.equal((await req('/api/stories',a.token,'POST',{data:Buffer.from('<svg/>').toString('base64')})).status,400)
  const create=await req('/api/stories',a.token,'POST',{data:media,caption:'Hello'}); assert.equal(create.status,201); const id=(await json(create)).id
  assert.equal((await req(`/api/stories/${id}/media`,null)).status,401)
  assert.equal((await req(`/api/stories/${id}/media`,c.token)).status,404)
  assert.equal((await json(await req('/api/stories',b.token))).items.length,0)
  const chat=await req('/api/chats/direct',a.token,'POST',{userId:b.profile.id}); assert.equal(chat.status,200)
  const chatId=(await json(chat)).id
  assert.equal((await req(`/api/stories/${id}/media`,b.token)).status,404)
  assert.equal((await req(`/api/chats/${chatId}/messages`,b.token,'POST',{body:'Hi'})).status,200)
  assert.equal((await req(`/api/stories/${id}/media`,b.token)).status,404)
  assert.equal((await req(`/api/chats/${chatId}/messages`,a.token,'POST',{body:'Hello'})).status,200)
  assert.equal((await json(await req('/api/stories',b.token))).items[0].caption,'Hello')
  const image=await req(`/api/stories/${id}/media`,b.token); assert.equal(image.status,200); assert.equal(image.headers.get('cache-control'),'private, no-store'); assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'),media)
  assert.equal((await req(`/api/stories/${id}`,b.token,'DELETE')).status,404)
  await stop(); await start(); assert.equal((await req(`/api/stories/${id}/media`,b.token)).status,200)
  assert.equal((await req(`/api/stories/${id}`,a.token,'DELETE')).status,200); assert.equal((await req(`/api/stories/${id}/media`,b.token)).status,404); assert.equal((await readdir(path.join(dir,'stories'))).length,0)
  const id2=(await json(await req('/api/stories',a.token,'POST',{data:media}))).id
  await stop(); const dbpath=path.join(dir,'db.json'),db=JSON.parse(await readFile(dbpath,'utf8'));db.stories.find(s=>s.id===id2).expires_at=Date.now()-1;await writeFile(dbpath,JSON.stringify(db));await start()
  assert.equal((await req(`/api/stories/${id2}/media`,b.token)).status,404); assert.equal((await json(await req('/api/stories',a.token))).items.length,0); assert.equal((await readdir(path.join(dir,'stories'))).length,0)
 } finally {if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
})
