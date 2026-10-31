import { appendFileSync } from 'node:fs'
const original = globalThis.fetch
globalThis.fetch = (url, options) => String(url) === 'https://api.fish.audio/v1/tts'
  ? (process.env.FISH_MOCK_LOG && appendFileSync(process.env.FISH_MOCK_LOG, 'call\n'), new Promise(resolve => setTimeout(() => resolve(new Response(Buffer.from('mock mp3'), { headers: { 'content-type': 'audio/mpeg' } })), 20)))
  : original(url, options)
