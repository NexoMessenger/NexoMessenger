import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpenRouter, OPENROUTER_MODEL } from '../server/ai-openrouter.mjs'

const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data })
test('status is honest about missing key, endpoint availability, and network errors', async () => {
  const absent = createOpenRouter({ getKey: () => '', fetchImpl: () => { throw Error('must not fetch') } })
  assert.deepEqual(await absent.status(), { ready: false, reason: 'missing_key' })
  const unavailable = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async () => reply(200, { data: { endpoints: [] } }) })
  assert.deepEqual(await unavailable.status(), { ready: false, reason: 'model_unavailable' })
  const online = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async () => reply(200, { data: { endpoints: [{}] } }) })
  assert.deepEqual(await online.status(), { ready: true, reason: 'available' })
  const offline = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async () => { throw Error('no network') } })
  assert.deepEqual(await offline.status(), { ready: false, reason: 'network_error' })
})
test('answers use only free Qwen, with a zero price cap and no fallback model', async () => {
  let options
  const adapter = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async (url, opts) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); options = opts
    return reply(200, { choices: [{ message: { content: 'Hello' } }] })
  } })
  assert.deepEqual(await adapter.answer([{ role: 'user', content: 'Hi' }]), { answer: 'Hello' })
  const body = JSON.parse(options.body)
  assert.equal(body.model, OPENROUTER_MODEL)
  assert.ok(body.model.endsWith(':free'))
  assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0, request: 0 })
  assert.equal(body.models, undefined)
})
test('provider errors and empty answers never produce fake output', async () => {
  for (const [status, error] of [[429, 'AI_RATE_LIMIT'], [401, 'AI_AUTH_ERROR'], [404, 'AI_UNAVAILABLE'], [500, 'AI_UNAVAILABLE']]) {
    const adapter = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async () => reply(status, {}) })
    assert.deepEqual(await adapter.answer([]), { error })
  }
  const adapter = createOpenRouter({ getKey: () => 'test-key', fetchImpl: async () => reply(200, { choices: [] }) })
  assert.deepEqual(await adapter.answer([]), { error: 'AI_UNAVAILABLE' })
})
