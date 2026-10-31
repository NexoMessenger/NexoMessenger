import test from 'node:test'
import assert from 'node:assert/strict'
import { createGigachat } from '../server/ai-gigachat.mjs'
const AUTH = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const CHAT = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions'
const json = (status, body = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const reply = () => json(200, { choices: [{ message: { content: 'hello' } }] })

test('OAuth and chat use correct endpoints and reuse the token, then refresh on expiry', async () => {
  let now = 1_700_000_000_000, authCount = 0, calls = []
  const client = createGigachat({ getKey: () => 'fake-auth-key', now: () => now, uuid: () => 'test-uuid', fetchImpl: async (url, opts) => {
    calls.push({ url, ...opts })
    if (url === AUTH) { authCount++; return json(200, { access_token: 'token-' + authCount, expires_at: now + 1800000 }) }
    return reply()
  } })
  assert.equal(client.status().ready, true)
  assert.deepEqual(await client.answer([{ role: 'user', content: 'hi' }]), { answer: 'hello' })
  assert.deepEqual(await client.answer([]), { answer: 'hello' })
  assert.equal(authCount, 1)
  assert.equal(calls[0].headers.Authorization, 'Basic fake-auth-key')
  assert.equal(calls[0].headers.RqUID, 'test-uuid'); assert.equal(calls[0].body, 'scope=GIGACHAT_API_PERS')
  assert.equal(calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded'); assert.equal(calls[0].redirect, 'error'); assert.ok(calls[0].signal)
  assert.equal(calls[1].url, CHAT); assert.equal(calls[1].headers.Authorization, 'Bearer token-1')
  assert.deepEqual(JSON.parse(calls[1].body), { model: 'GigaChat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 384, stream: false })
  now += 1740001
  assert.deepEqual(await client.answer([]), { answer: 'hello' }); assert.equal(authCount, 2)
})

test('simultaneous requests share token acquisition and changed key invalidates cache', async () => {
  let count = 0, key = 'one'
  const client = createGigachat({ getKey: () => key, fetchImpl: async url => {
    if (url === AUTH) { count++; await new Promise(r => setTimeout(r, 10)); return json(200, { access_token: 'token', expires_at: Date.now() + 1800000 }) }
    return reply()
  } })
  assert.deepEqual(await Promise.all([client.answer([]), client.answer([])]), [{ answer: 'hello' }, { answer: 'hello' }]); assert.equal(count, 1)
  key = 'two'; await client.answer([]); assert.equal(count, 2)
})

test('401 in chat refreshes token once and retries; repeated 401 stops', async () => {
  let auth = 0, chat = 0
  const client = createGigachat({ getKey: () => 'test', fetchImpl: async url => {
    if (url === AUTH) { auth++; return json(200, { access_token: `token-${auth}`, expires_at: Date.now() + 1800000 }) }
    chat++; return json(401)
  } })
  assert.deepEqual(await client.answer([]), { error: 'AI_AUTH_ERROR' }); assert.equal(auth, 2); assert.equal(chat, 2)
})

test('provider failures, invalid certificate and timeout are safely surfaced', async () => {
  assert.deepEqual(await createGigachat({ getKey: () => '' }).answer([]), { error: 'AI_NOT_CONFIGURED' })
  for (const [status, error] of [[401, 'AI_AUTH_ERROR'], [403, 'AI_FORBIDDEN'], [429, 'AI_RATE_LIMIT'], [500, 'AI_UNAVAILABLE']]) {
    const c = createGigachat({ getKey: () => 'key', fetchImpl: async () => json(status) })
    assert.deepEqual(await c.answer([]), { error })
  }
  const timeout = createGigachat({ getKey: () => 'key', fetchImpl: async () => { throw new Error('timeout') } })
  assert.deepEqual(await timeout.answer([]), { error: 'AI_UNAVAILABLE' })
  const tls = createGigachat({ getKey: () => 'key', fetchImpl: async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } }) } })
  assert.deepEqual(await tls.answer([]), { error: 'AI_CERT_ERROR' })
  const badFile = createGigachat({ getKey: () => 'key', caFile: '/missing/cert' })
  assert.equal(badFile.status().reason, 'invalid_cert'); assert.deepEqual(await badFile.answer([]), { error: 'AI_CERT_ERROR' })
  const badToken = createGigachat({ getKey: () => 'key', fetchImpl: async () => json(200, { access_token: 'token', expires_at: Date.now() + 30000 }) })
  assert.deepEqual(await badToken.answer([]), { error: 'AI_UNAVAILABLE' })
})
