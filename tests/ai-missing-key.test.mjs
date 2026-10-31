import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

test('server starts without a GigaChat key and logs a safe warning', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'nexo-gigachat-missing-'))
  const env = { ...process.env, NEXO_DATA_DIR: dir, PORT: '0' }
  delete env.GIGACHAT_AUTH_KEY
  const child = spawn(process.execPath, ['server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let logs = ''
  child.stdout.on('data', data => { logs += data.toString() })
  child.stderr.on('data', data => { logs += data.toString() })
  try {
    for (let i = 0; i < 100 && !logs.includes('listening on'); i++) {
      if (child.exitCode !== null) throw new Error('Server exited')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.match(logs, /GigaChat is not ready: missing_key/)
    assert.match(logs, /listening on/)
  } finally {
    child.kill('SIGTERM')
    if (child.exitCode === null) await once(child, 'exit')
    await rm(dir, { recursive: true, force: true })
  }
})
