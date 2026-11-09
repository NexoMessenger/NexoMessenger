import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import net from 'node:net'
import { once } from 'node:events'
import WebSocket from 'ws'

test('HTTPS enforcement, local proxy, protected database and corrupt data safety', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-https-'));const server=net.createServer().listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));let child
 const start=()=>{child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NEXO_DATA_DIR:dir,NEXO_REQUIRE_HTTPS:'1'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);return {output:()=>output}}
 const stop=async()=>{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit')}
 try {
  const logs=start();for(let i=0;i<100&&!logs.output().includes('listening on');i++){if(child.exitCode!==null)throw Error(logs.output());await new Promise(r=>setTimeout(r,50))}
  const base=`http://127.0.0.1:${port}`;let r=await fetch(base+'/api/health',{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://nexomessenger.space/api/health')
  r=await fetch(base+'/api/auth/login',{method:'POST'});assert.equal(r.status,403);assert.equal((await r.json()).error,'HTTPS_REQUIRED')
  r=await fetch(base+'/api/health',{headers:{'x-forwarded-proto':'https'}});assert.equal(r.status,200);assert.match(r.headers.get('strict-transport-security'),/max-age=/);assert.equal(r.headers.get('x-content-type-options'),'nosniff')
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);const [error]=await once(ws,'error');assert.match(error.message,/401/)
  assert.equal((await stat(path.join(dir,'db.json'))).mode & 0o777,0o600)
  await stop(); const file=path.join(dir,'db.json');const data=Buffer.from('{broken');await writeFile(file,data);const bad=start();await once(child,'exit');assert.notEqual(child.exitCode,0);assert.deepEqual(await readFile(file),data);assert.ok(bad.output())
 } finally {if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true})}
})
