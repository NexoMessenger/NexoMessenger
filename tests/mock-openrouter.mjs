// Test-only network stub. Production code never imports this file.
const nativeFetch = globalThis.fetch
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://openrouter.ai/api/v1/models/')) {
    return new Response(JSON.stringify({ data: { endpoints: [{}] } }), { status: 200 })
  }
  if (String(url) === 'https://api.deepseek.com/chat/completions') {
    const data = JSON.parse(options.body)
    if (data.messages.at(-1).content === 'quota') return new Response('', { status: 429 })
    if (data.messages.at(-1).content === 'balance') return new Response('', { status: 402 })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }), { status: 200 })
  }
  if (String(url) === 'https://openrouter.ai/api/v1/chat/completions') {
    const data = JSON.parse(options.body)
    if (data.messages.at(-1).content === 'quota') return new Response('', { status: 429 })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }), { status: 200 })
  }
  return nativeFetch(url, options)
}
