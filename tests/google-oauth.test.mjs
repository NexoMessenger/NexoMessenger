import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { registerGoogleRoutes, verifyGoogle } from '../server/google-oauth.mjs'
import { generateKeyPair, SignJWT } from 'jose'

async function fixture(t, overrides={}) {
 const app=express(), db={users:[],profiles:[],sessions:[]}; let n=0
 const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r)); t.after(()=>server.close())
 const base=`http://127.0.0.1:${server.address().port}`
 const env={GOOGLE_CLIENT_ID:'client', GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:`${base}/api/auth/google/callback`}
 let identity={sub:'google-123',email:'new@example.com',email_verified:true,name:'New Person'}
 registerGoogleRoutes(app,{db,persist(){},uid:()=>`id${++n}`,now:()=>new Date().toISOString(),sessionTTL:10000,touchGlobal(){},env,exchange:async()=> 'mock-id-token',verify:async()=>identity,...overrides})
 const request=(path,opts={})=>fetch(base+path,{redirect:'manual',...opts,headers:{origin:base,...opts.headers}})
 const start=async()=>{let r=await request('/api/auth/google/start',{method:'POST'}); let data=await r.json(); return {r,data,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const callback=async(a,query='')=>request(`/api/auth/google/callback?state=${new URL(a.data.url).searchParams.get('state')}&code=ok${query}`,{headers:{cookie:a.cookie}})
 return {db,env,request,start,callback,setIdentity:i=>identity=i}
}
test('mock flow creates and signs in same account, ticket cannot be replayed',async t=>{
 const f=await fixture(t); let a=await f.start(); assert.equal(a.r.status,200)
 let url=new URL(a.data.url); assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('nonce'))
 let cb=await f.callback(a);assert.equal(cb.status,303);assert.match(cb.headers.get('location'),/google_auth=complete/)
 const cookie=cb.headers.get('set-cookie').split(', ').find(s=>s.startsWith('nexo_google_ticket='))?.split(';')[0];assert.ok(cookie)
 let done=await f.request('/api/auth/google/complete',{method:'POST',headers:{cookie}});assert.equal(done.status,200);assert.ok((await done.json()).token);assert.equal(f.db.users.length,1);assert.equal(f.db.profiles.length,1);assert.equal(f.db.sessions.length,1)
 assert.equal((await f.request('/api/auth/google/complete',{method:'POST',headers:{cookie}})).status,400)
 a=await f.start();cb=await f.callback(a);const c=cb.headers.get('set-cookie').split(', ').find(s=>s.startsWith('nexo_google_ticket='))?.split(';')[0]
 assert.equal((await f.request('/api/auth/google/complete',{method:'POST',headers:{cookie:c}})).status,200);assert.equal(f.db.users.length,1);assert.equal(f.db.sessions.length,2)
})
test('rejects invalid state, origin, unverified email and pre-existing account',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/api/auth/google/start',{method:'POST',headers:{origin:'http://evil.example'}})).status,403)
 let a=await f.start();let cb=await f.request(`/api/auth/google/callback?state=${new URL(a.data.url).searchParams.get('state')}&code=ok`,{headers:{cookie:'nexo_google_state=wrong'}});assert.match(cb.headers.get('location'),/google_auth=error/);assert.equal(f.db.sessions.length,0)
 f.setIdentity({sub:'x',email:'new@example.com',email_verified:false});a=await f.start();cb=await f.callback(a);assert.match(cb.headers.get('location'),/google_auth=error/);assert.equal(f.db.users.length,0)
 f.db.users.push({id:'old',email:'new@example.com',passwordHash:'preserved'});f.setIdentity({sub:'x',email:'NEW@example.com',email_verified:true});a=await f.start();cb=await f.callback(a)
 const cookie=cb.headers.get('set-cookie').split(', ').find(s=>s.startsWith('nexo_google_ticket='))?.split(';')[0]
 const result=await f.request('/api/auth/google/complete',{method:'POST',headers:{cookie}});assert.equal(result.status,409);assert.equal((await result.json()).error,'GOOGLE_EMAIL_EXISTS');assert.equal(f.db.users.length,1);assert.equal(f.db.users[0].passwordHash,'preserved');assert.equal(f.db.sessions.length,0)
})
test('missing or unsafe configuration is unavailable',async t=>{
 const f=await fixture(t);delete f.env.GOOGLE_CLIENT_SECRET;assert.equal((await f.start()).r.status,503)
 f.env.GOOGLE_CLIENT_SECRET='secret';f.env.GOOGLE_REDIRECT_URI='http://example.com/api/auth/google/callback';assert.equal((await f.start()).r.status,503)
})

test('ID token verification checks signature, issuer, audience, expiry and nonce',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256')
 const sign=(claims={})=>new SignJWT({sub:'sub',email:'a@example.com',email_verified:true,nonce:'expected',...claims}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey)
 const token=await sign(); assert.equal((await verifyGoogle(token,'client','expected',publicKey)).sub,'sub')
 await assert.rejects(verifyGoogle(token,'other','expected',publicKey))
 await assert.rejects(verifyGoogle(token,'client','wrong',publicKey))
 const other=await generateKeyPair('RS256');await assert.rejects(verifyGoogle(token,'client','expected',other.publicKey))
 const expired=await new SignJWT({nonce:'expected'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience('client').setIssuedAt().setExpirationTime('1 second ago').sign(privateKey)
 await assert.rejects(verifyGoogle(expired,'client','expected',publicKey))
 const badIssuer=await new SignJWT({nonce:'expected'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://evil.example').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey)
 await assert.rejects(verifyGoogle(badIssuer,'client','expected',publicKey))
})
