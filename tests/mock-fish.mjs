const original = globalThis.fetch
globalThis.fetch = (url, options) => String(url) === 'https://api.fish.audio/v1/tts'
  ? Promise.resolve(new Response(Buffer.from('mock mp3'), { headers: { 'content-type': 'audio/mpeg' } }))
  : original(url, options)
