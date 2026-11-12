import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const script=path.resolve('deploy/activate-release.sh')
test('release is checked before replacement, keeps data and old assets',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-release-')), stage=path.join(dir,'.release-stage-123-1')
 const run=()=>spawnSync('bash',[script,dir,stage],{encoding:'utf8'})
 try {
  for(const folder of ['dist/assets','server','data','.release-stage-123-1/dist/assets','.release-stage-123-1/server']) await mkdir(path.join(dir,folder),{recursive:true})
  await writeFile(path.join(dir,'dist/index.html'),'old page');await writeFile(path.join(dir,'dist/assets/old.js'),'old asset');await writeFile(path.join(dir,'server/index.mjs'),'old server');await writeFile(path.join(dir,'data/db.json'),'accounts');
  await writeFile(path.join(stage,'dist/index.html'),'new page')
  assert.notEqual(run().status,0);assert.equal(await readFile(path.join(dir,'dist/index.html'),'utf8'),'old page');assert.equal(await readFile(path.join(dir,'server/index.mjs'),'utf8'),'old server')
  await writeFile(path.join(stage,'server/index.mjs'),'new server');await writeFile(path.join(stage,'dist/assets/new.js'),'new asset')
  const result=run();assert.equal(result.status,0,result.stderr);assert.equal(await readFile(path.join(dir,'dist/index.html'),'utf8'),'new page');assert.equal(await readFile(path.join(dir,'server/index.mjs'),'utf8'),'new server');assert.equal(await readFile(path.join(dir,'data/db.json'),'utf8'),'accounts');assert.equal(await readFile(path.join(dir,'dist/assets/old.js'),'utf8'),'old asset');assert.equal(await readFile(path.join(dir,'dist/assets/new.js'),'utf8'),'new asset')
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('activation rolls back both live directories if installing the new server fails',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-rollback-')),stage=path.join(dir,'.release-stage-456-1'),bin=path.join(dir,'bin')
 try {
  for(const folder of ['dist','server','data','.release-stage-456-1/dist','.release-stage-456-1/server','bin']) await mkdir(path.join(dir,folder),{recursive:true})
  for(const [file,content] of [['dist/index.html','old page'],['server/index.mjs','old server'],['data/db.json','accounts'],['.release-stage-456-1/dist/index.html','new page'],['.release-stage-456-1/server/index.mjs','new server']]) await writeFile(path.join(dir,file),content)
  const wrapper=path.join(bin,'mv');await writeFile(wrapper,'#!/bin/bash\ncase "$1" in */.release-stage-456-1/server) exit 1;; esac\nexec /usr/bin/mv "$@"\n',{mode:0o755})
  const result=spawnSync('bash',[script,dir,stage],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`}})
  assert.notEqual(result.status,0);assert.equal(await readFile(path.join(dir,'dist/index.html'),'utf8'),'old page');assert.equal(await readFile(path.join(dir,'server/index.mjs'),'utf8'),'old server');assert.equal(await readFile(path.join(dir,'data/db.json'),'utf8'),'accounts')
 }finally{await rm(dir,{recursive:true,force:true})}
})
