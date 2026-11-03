import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
import { act } from 'react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('image opens inside NEXO; file download shows real progress and can be cancelled', async () => {
 const dir = await mkdtemp(path.join(tmpdir(), 'nexo-attachment-'))
 const bundle = await build({ entryPoints:['src/components/AttachmentMedia.tsx'], bundle:true, platform:'node', format:'cjs', jsx:'automatic', write:false, external:['react','react-dom','react/jsx-runtime'], plugins:[{name:'i18n',setup(b){b.onResolve({filter:/^\.\.\/i18n$/},()=>({path:'i18n',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const useI18n=()=>({t:(key)=>key})',loader:'js'}))}}] })
 const file=path.join(dir,'bundle.cjs'); await writeFile(file,bundle.outputFiles[0].contents)
 // Resolve external React from the checkout rather than the temporary folder.
 const require=createRequire(import.meta.url); const Module=require('module'); const old=Module._resolveFilename; const paths={react:require.resolve('react'),'react-dom':require.resolve('react-dom'),'react/jsx-runtime':require.resolve('react/jsx-runtime')}
 Module._resolveFilename=function(request,parent,...rest){ if(paths[request]) return paths[request]; return old.call(this,request,parent,...rest) }
 const {ImageAttachment, FileAttachment}=require(file); Module._resolveFilename=old
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'}); globalThis.window=dom.window; globalThis.document=dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT=true
 let request
 class FakeXHR { open() {} send(){request=this} abort(){this.onabort?.()} }
 globalThis.XMLHttpRequest=FakeXHR
 const root=createRoot(document.getElementById('root'))
 try {
  await act(async()=>root.render(React.createElement(ImageAttachment,{url:'/a.png',name:'a.png'})))
  await act(async()=>document.querySelector('.attachment-image-button').click())
  assert.ok(document.querySelector('.image-viewer'))
  assert.equal(document.querySelector('.image-viewer-stage img').getAttribute('src'),'/a.png')
  await act(async()=>document.querySelector('.image-viewer-head button').click())
  assert.equal(document.querySelector('.image-viewer'),null)
  await act(async()=>root.render(React.createElement(FileAttachment,{url:'/file',name:'test.apk'})))
  await act(async()=>document.querySelector('.attachment-download-action').click())
  await act(async()=>request.onprogress({loaded:1048576,total:5242880,lengthComputable:true}))
  assert.match(document.querySelector('.attachment-download-label').textContent,/1\.0 MB \/ 5\.0 MB/)
  await act(async()=>document.querySelector('.attachment-download-action').click())
  assert.equal(document.querySelector('.attachment-download-label small').textContent,'media.download')
 } finally { await act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.XMLHttpRequest;await rm(dir,{recursive:true,force:true}) }
})
