import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeepSeek, DEEPSEEK_MODEL } from '../server/ai-deepseek.mjs'
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
test('only DeepSeek is called with bounded output and server-only key', async () => {
  let request
  const client = createDeepSeek({ getKey: () => 'test-key', fetchImpl: async (url, opts) => { request = { url, ...opts }; return response(200, { choices: [{ message: { content: 'hi' } }] }) } })
  assert.equal(client.status().ready, true)
  assert.deepEqual(await client.answer([{ role: 'user', content: 'hello' }]), { answer: 'hi' })
  const body = JSON.parse(request.body)
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions')
  assert.equal(body.model, DEEPSEEK_MODEL); assert.equal(body.max_tokens, 384); assert.equal(body.thinking.type, 'disabled')
})
test('credentials, balance, quota and network errors are not faked', async () => {
  assert.deepEqual(await createDeepSeek({ getKey: () => '' }).answer([]), { error: 'AI_NOT_CONFIGURED' })
  for (const [status, error] of [[402, 'AI_BALANCE'], [429, 'AI_RATE_LIMIT'], [401, 'AI_AUTH_ERROR'], [500, 'AI_UNAVAILABLE']]) {
    const client = createDeepSeek({ getKey: () => 'test-key', fetchImpl: async () => response(status, {}) })
    assert.deepEqual(await client.answer([]), { error })
  }
})
