import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeFish, FISH_VOICE_ID } from '../server/fish-voice.mjs'

test('Fish synthesis uses selected voice and hides credentials from result', async () => {
  let options
  const result = await synthesizeFish('Привет', { key: 'test-key', fetchImpl: async (url, opts) => {
    assert.equal(url, 'https://api.fish.audio/v1/tts'); options = opts
    return new Response(Buffer.from('test audio'), { headers: { 'Content-Type': 'audio/mpeg' } })
  } })
  assert.equal(result.toString(), 'test audio')
  assert.equal(options.headers.Authorization, 'Bearer test-key')
  assert.equal(options.headers.model, 's2.1-pro-free')
  assert.equal(JSON.parse(options.body).reference_id, FISH_VOICE_ID)
  assert.equal(options.redirect, 'error')
})
test('Fish provider failures and invalid or oversized audio fail closed', async () => {
  for (const response of [new Response('', { status: 401 }), new Response('oops', { headers: { 'Content-Type': 'application/json' } }), new Response(Buffer.alloc(4 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'audio/mpeg' } })]) {
    assert.equal(await synthesizeFish('hello', { key: 'x', fetchImpl: async () => response }), null)
  }
  assert.equal(await synthesizeFish('hello', { key: 'x', fetchImpl: async () => { throw new Error('secret') } }), null)
})
