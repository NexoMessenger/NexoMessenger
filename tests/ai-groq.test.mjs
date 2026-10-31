import test from 'node:test'
import assert from 'node:assert/strict'
import { createGroq, DEFAULT_GROQ_MODEL } from '../server/ai-groq.mjs'
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
test('Groq requests use server-only credentials, bounded output and a timeout', async () => {
  let request
  const client = createGroq({ getKey: () => 'test-key', fetchImpl: async (url, opts) => { request = { url, ...opts }; return response(200, { choices: [{ message: { content: 'hi' } }] }) } })
  assert.equal(client.status().ready, true)
  assert.deepEqual(await client.answer([{ role: 'user', content: 'hello' }]), { answer: 'hi' })
  const body = JSON.parse(request.body)
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(body.model, DEFAULT_GROQ_MODEL); assert.equal(body.max_completion_tokens, 1024); assert.equal(body.reasoning_effort, 'low')
  assert.equal(request.headers.Authorization, 'Bearer test-key'); assert.equal(request.redirect, 'error'); assert.ok(request.signal)
})
test('missing configuration and provider failures are not faked', async () => {
  assert.deepEqual(await createGroq({ getKey: () => '' }).answer([]), { error: 'AI_NOT_CONFIGURED' })
  for (const [status, error] of [[429, 'AI_RATE_LIMIT'], [401, 'AI_AUTH_ERROR'], [403, 'AI_FORBIDDEN'], [500, 'AI_UNAVAILABLE']]) {
    const client = createGroq({ getKey: () => 'test-key', fetchImpl: async () => response(status, {}) })
    assert.deepEqual(await client.answer([]), { error })
  }
  assert.deepEqual(await createGroq({ getKey: () => 'test-key', fetchImpl: async () => { throw new Error('timeout') } }).answer([]), { error: 'AI_UNAVAILABLE' })
})
test('configurable settings work but cannot leak credentials to another origin', async () => {
  let request
  const client = createGroq({ getKey: () => 'test-key', model: 'llama-3.3-70b-versatile', timeoutMs: 1000, fetchImpl: async (url, opts) => { request = { url, ...opts }; return response(200, { choices: [{ message: { content: 'ok' } }] }) } })
  assert.deepEqual(await client.answer([]), { answer: 'ok' }); assert.equal(JSON.parse(request.body).model, 'llama-3.3-70b-versatile'); assert.equal(JSON.parse(request.body).reasoning_effort, undefined)
  for (const baseUrl of ['http://api.groq.com/openai/v1', 'https://evil.example', 'https://api.groq.com@evil.example', 'https://api.groq.com:8443', 'https://api.groq.com/?x=1']) {
    const invalid = createGroq({ getKey: () => 'test-key', baseUrl, fetchImpl: () => { throw new Error('must not call') } })
    assert.equal(invalid.status().reason, 'invalid_config'); assert.deepEqual(await invalid.answer([]), { error: 'AI_UNAVAILABLE' })
  }
})
