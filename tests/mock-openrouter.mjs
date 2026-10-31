// Test-only network stub. Production code never imports this file.
const nativeFetch = globalThis.fetch
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith('https://openrouter.ai/api/v1/models/')) {
    return new Response(JSON.stringify({ data: { endpoints: [{}] } }), { status: 200 })
  }
  if (String(url) === 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth') {
    return new Response(JSON.stringify({ access_token: 'mock-token', expires_at: Date.now() + 1800000 }), { status: 200 })
  }
  if (String(url) === 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions') {
    const data = JSON.parse(options.body)
    if (data.messages[0]?.role !== 'system' || (!data.messages[0].content.includes('NEXO navigation guide:') && !data.messages[0].content.includes('Return only the edited text.'))) return new Response('', { status: 500 })
    if (data.messages.at(-1).content === 'quota') return new Response('', { status: 429 })
    if (data.messages.at(-1).content === 'forbidden') return new Response('', { status: 403 })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }), { status: 200 })
  }
  if (String(url) === 'https://openrouter.ai/api/v1/chat/completions') {
    const data = JSON.parse(options.body)
    if (data.messages.at(-1).content === 'quota') return new Response('', { status: 429 })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }), { status: 200 })
  }
  return nativeFetch(url, options)
}
