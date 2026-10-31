import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createServer } from 'vite'
import { stop as stopEsbuild } from 'esbuild'

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://nexo.example/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.File = dom.window.File
globalThis.FileReader = dom.window.FileReader
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.localStorage = dom.window.localStorage
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// React act should use Node timers rather than retaining MessageChannel ports.
globalThis.MessageChannel = undefined
dom.window.HTMLMediaElement.prototype.play = async () => {}
let trackStops = 0
let streamFactory = () => Promise.resolve({ getTracks: () => [{ stop: () => { trackStops++ } }] })
Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: (...args) => streamFactory(...args) } })
class FakeRecorder {
  static isTypeSupported(type) { return type === 'video/webm' }
  constructor() { this.state = 'inactive'; this.mimeType = 'video/webm' }
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['fake video'], { type: this.mimeType }) }); this.onstop?.() }) }
}
globalThis.MediaRecorder = FakeRecorder
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
const { default: Recorder } = await vite.ssrLoadModule('/src/components/VideoRecorder.tsx')
const { default: Composer } = await vite.ssrLoadModule('/src/components/Composer.tsx')
const { fileToBase64 } = await vite.ssrLoadModule('/src/lib/api.ts')
await vite.close()
const container = document.getElementById('app')
const root = createRoot(container)
let clock = 1700000000000
const actualNow = Date.now
Date.now = () => clock
const props = (intent, send, close, error) => React.createElement(Recorder, { intent, onSend: send, onClose: close, onError: error })
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)) }

test('holding and release records one blob; cancelling never sends', async () => {
  let sent = [], closed = 0, errors = []
  const send = (...args) => sent.push(args), close = () => { closed++ }, error = x => errors.push(x)
  await act(async () => { root.render(props('holding', send, close, error)); await flush() })
  assert.match(container.textContent, /Release to send/)
  clock += 1100
  await act(async () => { root.render(props('send', send, close, error)); await flush() })
  assert.equal(sent.length, 1); assert.equal(sent[0][0].type, 'video/webm'); assert.equal(sent[0][1], 1)
  assert.equal(closed, 1); assert.equal(errors.length, 0); assert.equal(trackStops, 1)
  await act(async () => { root.render(null) })
  sent = []; closed = 0; trackStops = 0
  await act(async () => { root.render(props('holding', send, close, error)); await flush() })
  clock += 1100
  await act(async () => { root.render(props('cancel', send, close, error)); await flush() })
  assert.equal(sent.length, 0); assert.equal(closed, 1); assert.equal(trackStops, 1)
  await act(async () => { root.render(null) })
})

test('release before permission resolves never sends; late streams stop', async () => {
  let resolveStream, sent = 0, closed = 0, errors = []
  trackStops = 0
  streamFactory = () => new Promise(resolve => { resolveStream = resolve })
  const send = () => { sent++ }, close = () => { closed++ }, error = x => errors.push(x)
  await act(async () => { root.render(props('holding', send, close, error)); await flush() })
  await act(async () => { root.render(props('send', send, close, error)); await flush() })
  assert.equal(sent, 0); assert.equal(closed, 1); assert.equal(errors.length, 1)
  await act(async () => { root.render(null) })
  await act(async () => { resolveStream({ getTracks: () => [{ stop: () => { trackStops++ } }] }); await flush() })
  assert.equal(trackStops, 1); assert.equal(sent, 0)
})

test('composer pointer hold sends on release; sliding left cancels', async () => {
  let sent = [], uploads = []
  trackStops = 0
  streamFactory = () => Promise.resolve({ getTracks: () => [{ stop: () => { trackStops++ } }] })
  const upload = async file => { uploads.push(file); return { url: '/api/files/test.webm', name: file.name, type: file.type } }
  const onSend = async (...args) => { sent.push(args) }
  await act(async () => { root.render(React.createElement(Composer, { placeholder: 'Message', sending: false, onSend, onTyping: () => {}, upload })); await flush() })
  const button = container.querySelector('.video-hold-button')
  assert.ok(button)
  const pointer = (target, type, x) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x })
    Object.defineProperty(event, 'pointerId', { value: 4 })
    target.dispatchEvent(event)
  }
  await act(async () => { pointer(button, 'pointerdown', 200); await flush() })
  assert.ok(container.querySelector('.video-hold-overlay'))
  clock += 1100
  await act(async () => { pointer(window, 'pointerup', 200); await flush() })
  assert.equal(uploads.length, 1); assert.equal(sent.length, 1); assert.equal(sent[0][1].type, 'video/webm')
  assert.equal(sent[0][1].duration, 1); assert.equal(trackStops, 1)
  await act(async () => { pointer(button, 'pointerdown', 200); await flush() })
  clock += 1100
  await act(async () => { pointer(window, 'pointermove', 50); pointer(window, 'pointerup', 50); await flush() })
  assert.equal(sent.length, 1); assert.equal(uploads.length, 1); assert.equal(trackStops, 2)
  await act(async () => { root.render(null) })
})

test('strict mode disposes the first asynchronous camera request', async () => {
  const resolvers = []; let sent = 0, closed = 0
  trackStops = 0
  streamFactory = () => new Promise(resolve => resolvers.push(resolve))
  const send = () => { sent++ }, close = () => { closed++ }, error = () => {}
  await act(async () => { root.render(React.createElement(React.StrictMode, null, props('holding', send, close, error))); await flush() })
  assert.equal(resolvers.length, 2)
  const stream = () => ({ getTracks: () => [{ stop: () => { trackStops++ } }] })
  await act(async () => { resolvers[0](stream()); resolvers[1](stream()); await flush() })
  assert.equal(trackStops, 1)
  clock += 1100
  await act(async () => { root.render(React.createElement(React.StrictMode, null, props('send', send, close, error))); await flush() })
  assert.equal(sent, 1); assert.equal(closed, 1); assert.equal(trackStops, 2)
  await act(async () => root.render(null))
})

test('codec commas in video MIME do not corrupt the uploaded payload', async () => {
  const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3, 255])
  for (const type of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/mp4', 'image/png']) {
    const file = new File([bytes], 'attachment', { type })
    assert.deepEqual(Buffer.from(await fileToBase64(file), 'base64'), bytes, type)
  }
})

test.after(async () => { await act(async () => root.unmount()); Date.now = actualNow; dom.window.close(); stopEsbuild(); for (const handle of process._getActiveHandles()) if (handle.constructor.name === 'MessagePort') handle.unref() })
