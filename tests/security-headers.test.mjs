import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('security headers, hash-router shell, sensitive-looking paths, and sanitized errors', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-security-')); const listener=net.createServer().listen(0,'127.0.0.1'); await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r))
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NEXO_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d)
 try {
  for(let i=0;i<100&&!output.includes('listening on');i++){if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,50))} assert.match(output,/listening on/)
  const base=`http://127.0.0.1:${port}`; const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/id="root"/)
  const csp=home.headers.get('content-security-policy');assert.match(csp,/script-src 'self'/);assert.match(csp,/worker-src 'self' blob:/);assert.match(csp,/object-src 'none'/);assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/)
  const pp=home.headers.get('permissions-policy');assert.match(pp,/camera=\(self\)/);assert.match(pp,/microphone=\(self\)/);assert.match(pp,/usb=\(\)/)
  assert.equal(home.headers.get('x-powered-by'),null)
  for(const file of ['/.env','/.git/config','/data/db.json','/server/index.mjs','/wp-config.php','/not-a-page']) {const res=await fetch(base+file);assert.equal(res.status,404,file);assert.doesNotMatch(await res.text(),/id="root"/)}
  const asset=await fetch(base+'/privacy.html');assert.equal(asset.status,200)
  const bad=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{wrong'});assert.equal(bad.status,400);assert.deepEqual(await bad.json(),{error:'Invalid request.'})
  const missing=await fetch(base+'/api/files/missing-file');assert.equal(missing.status,404);assert.deepEqual(await missing.json(),{error:'Not found.'})
 } finally {child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');await rm(dir,{recursive:true,force:true})}
})
