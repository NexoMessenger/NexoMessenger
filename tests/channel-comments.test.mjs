import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'

test('channel comments are owner-controlled, scoped, persisted and moderatable', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-comments-'))
  const listener = net.createServer().listen(0, '127.0.0.1'); await once(listener, 'listening')
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`; let child
  const start = async () => {
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), NEXO_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''; child.stdout.on('data', d => { output += d }); child.stderr.on('data', d => { output += d })
    for (let i = 0; i < 100 && !output.includes('listening on'); i++) { if (child.exitCode !== null) throw new Error(output); await new Promise(r => setTimeout(r, 50)) }
    assert.match(output, /listening on/)
  }
  const stop = async () => { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit') }
  const req = async (url, { token, method = 'GET', body } = {}) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: r.status, json: await r.json() }
  }
  try {
    await start()
    const register = async n => (await req('/api/auth/register', { method: 'POST', body: { email: `${n}@example.test`, password: 'secret1', username: n, displayName: n } })).json
    const owner = await register('commentowner'), subscriber = await register('commentsub'), visitor = await register('commentvisitor')
    const cid = (await req('/api/channels', { token: owner.token, method: 'POST', body: { name: 'Test', isPublic: true } })).json.id
    const pid = (await req(`/api/channels/${cid}/posts`, { token: owner.token, method: 'POST', body: { body: 'Post' } })).json.post.id
    const setting = `/api/channels/${cid}/comments-setting`, comments = `/api/channels/${cid}/posts/${pid}/comments`
    assert.equal((await req(setting, { method: 'PUT', body: { enabled: true } })).status, 401)
    assert.equal((await req(setting, { token: subscriber.token, method: 'PUT', body: { enabled: true } })).status, 403)
    assert.equal((await req(setting, { token: owner.token, method: 'PUT', body: { enabled: 'yes' } })).status, 400)
    assert.equal((await req(comments, { token: subscriber.token, method: 'POST', body: { body: 'No' } })).status, 403)
    assert.equal((await req(setting, { token: owner.token, method: 'PUT', body: { enabled: true } })).status, 200)
    assert.equal((await req(comments, { token: subscriber.token, method: 'POST', body: { body: 'No subscription' } })).status, 403)
    await req(`/api/channels/${cid}/subscribe`, { token: subscriber.token, method: 'POST' })
    assert.equal((await req(comments, { token: subscriber.token, method: 'POST', body: { body: 'x'.repeat(1001) } })).status, 400)
    const comment = (await req(comments, { token: subscriber.token, method: 'POST', body: { body: 'Hello!' } })).json.comment
    assert.equal(comment.body, 'Hello!')
    assert.equal((await req(comments, { token: visitor.token })).json.comments[0].author_id, subscriber.profile.id)
    assert.equal((await req(`/api/channels/${cid}/posts`, { token: visitor.token })).json.posts[0].comment_count, 1)
    assert.equal((await req(`${comments}/${comment.id}`, { token: visitor.token, method: 'DELETE' })).status, 403)
    await req(setting, { token: owner.token, method: 'PUT', body: { enabled: false } })
    assert.equal((await req(comments, { token: subscriber.token, method: 'POST', body: { body: 'Closed' } })).status, 403)
    await stop(); await start()
    assert.equal((await req(comments, { token: owner.token })).json.comments[0].body, 'Hello!')
    assert.equal((await req(`/api/channels/${cid}`, { token: owner.token })).json.channel.comments_enabled, false)
    assert.equal((await req(`${comments}/${comment.id}`, { token: owner.token, method: 'DELETE' })).status, 200)
    assert.equal((await req(comments, { token: owner.token })).json.comments.length, 0)
    const privateId = (await req('/api/channels', { token: owner.token, method: 'POST', body: { name: 'Private', isPublic: false } })).json.id
    const privatePost = (await req(`/api/channels/${privateId}/posts`, { token: owner.token, method: 'POST', body: { body: 'secret' } })).json.post.id
    assert.equal((await req(`/api/channels/${privateId}/subscribe`, { token: visitor.token, method: 'POST' })).status, 403)
    assert.equal((await req(`/api/channels/${privateId}/posts/${privatePost}/comments`, { token: visitor.token })).status, 403)
  } finally { if (child && child.exitCode === null) await stop(); await rm(dir, { recursive: true, force: true }) }
})
