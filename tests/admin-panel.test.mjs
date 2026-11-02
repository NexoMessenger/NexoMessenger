import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import net from 'node:net'
import { once } from 'node:events'
import WebSocket from 'ws'

test('owner ID alone manages restrictions and NEX; read-only, ban, simulation and restoration survive restart', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'nexo-admin-'))
 const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening'); const port = listener.address().port; await new Promise(r => listener.close(r)); let child
 const start = async () => { child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d); for (let i=0; i<100 && !output.includes('listening on'); i++) { if (child.exitCode !== null) throw Error(output); await new Promise(r => setTimeout(r,50)) } assert.match(output,/listening on/) }
 const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child,'exit') }
 const req = async (url, token, method='GET', body) => { const r=await fetch(`http://127.0.0.1:${port}${url}`, { method, headers: { 'content-type':'application/json', ...(token ? {authorization:`Bearer ${token}`} : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return {status:r.status, data:await r.json()} }
 try {
  await start()
  const reg = async name => (await req('/api/auth/register',null,'POST',{email:`${name}@test.example`,username:name,password:'secret1'})).data
  const owner=await reg('wallet'), user=await reg('person'), other=await reg('other')
  await stop(); const file=path.join(dir,'db.json'); const db=JSON.parse(await readFile(file,'utf8')); db.zeronOwnerId=owner.profile.id; db.zeronOwnerInitialized=true; await writeFile(file,JSON.stringify(db)); await start()
  const admin=owner.token, x=other.token, id=user.profile.id; let u=user.token
  assert.equal((await req('/api/admin/access',admin)).data.allowed,true)
  assert.equal((await req('/api/admin/access',u)).data.allowed,false)
  assert.equal((await req('/api/admin/users?q=pe',u)).status,403)
  assert.equal((await req(`/api/admin/users/${id}`,u,'POST',{action:'banned'})).status,403)
  assert.equal((await req(`/api/admin/users/${owner.profile.id}`,admin,'POST',{action:'banned'})).status,400)
  assert.equal((await req('/api/admin/users?q=person',admin)).data.users[0].id,id)
  const chat=(await req('/api/chats/direct',u,'POST',{userId:other.profile.id})).data.id
  await req(`/api/chats/${chat}/messages`,u,'POST',{body:'before'})
  const at=new Date(Date.now()+6000).toISOString()
  assert.equal((await req(`/api/chats/${chat}/scheduled`,u,'POST',{body:'later',sendAt:at})).status,200)
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws?token=${u}`); await once(ws,'open'); const closed=once(ws,'close')
  assert.equal((await req(`/api/admin/users/${id}`,admin,'POST',{action:'frozen'})).status,200); await closed
  assert.equal((await req('/api/me',u)).data.profile.account_status,'frozen')
  assert.equal((await req(`/api/chats/${chat}/messages`,u)).status,200)
  assert.equal((await req(`/api/chats/${chat}/messages`,u,'POST',{body:'blocked'})).data.error,'ACCOUNT_FROZEN')
  assert.equal((await req('/api/gifts/redeem',u,'POST',{code:'NEXO-MEGA-K7Q2'})).status,403)
  await new Promise(r => setTimeout(r,11000))
  assert.deepEqual((await req(`/api/chats/${chat}/messages`,x)).data.messages.map(m=>m.body),['before'])
  await stop(); await start()
  assert.equal((await req('/api/me',u)).data.profile.account_status,'frozen')
  assert.equal((await req(`/api/admin/users/${id}`,admin,'POST',{action:'fake_ban'})).status,200)
  assert.equal((await req('/api/me',u)).data.profile.account_status,'fake_ban')
  assert.equal((await req(`/api/chats/${chat}/messages`,u,'POST',{body:'simulation'})).status,403)
  const login = () => req('/api/auth/login',null,'POST',{email:'person@test.example',password:'secret1'})
  const relog = await login(); assert.equal(relog.status,200)
  const fresh = relog.data.token
  assert.equal((await req('/api/me',fresh)).data.profile.account_status,'normal')
  assert.equal((await req(`/api/chats/${chat}/messages`,fresh)).status,200)
  assert.equal((await req('/api/auth/logout',u,'POST')).status,200)
  assert.equal((await req(`/api/admin/users/${id}`,admin,'POST',{action:'banned'})).status,200)
  u = fresh
  assert.equal((await req('/api/me',fresh)).data.profile.account_status,'banned')
  assert.equal((await login()).data.error,'ACCOUNT_BANNED')
  assert.notEqual((await req('/api/auth/login',null,'POST',{email:'person@test.example',password:'wrong'})).data.error,'ACCOUNT_BANNED')
  assert.equal((await req(`/api/chats/${chat}/messages`,u)).data.error,'ACCOUNT_BANNED')
  assert.equal((await req(`/api/chats/${chat}/messages`,u,'POST',{body:'blocked'})).status,403)
  assert.equal((await req(`/api/admin/users/${id}`,admin,'POST',{action:'normal'})).status,200)
  assert.equal((await req(`/api/chats/${chat}/messages`,u,'POST',{body:'back'})).status,200)
  assert.equal((await req(`/api/admin/users/${id}`,admin,'POST',{action:'reset_nex'})).status,200)
  assert.equal((await req('/api/gifts/state',u)).data.balance,0)
  await stop(); await start(); assert.equal((await req('/api/gifts/state',u)).data.balance,0)
  const saved=JSON.parse(await readFile(file,'utf8')); assert.equal(saved.adminAudit.length,5); assert.equal(saved.moderation[id].status,'normal')
 } finally { if (child?.exitCode===null) await stop(); await rm(dir,{recursive:true,force:true}) }
})
