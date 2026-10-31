// Cloud speech is available only when the server has a Fish Audio key.
export const FISH_VOICE_ID = 'df3144db39a34a02bdeeb2d3ad172211'
export const FISH_GREETINGS = {
  en: 'Hello! I’m Astra, your NEXO Messenger assistant. How can I help?',
  ru: 'Привет! Я Астра, помощница мессенджера NEXO. Чем помочь?',
  uk: 'Привіт! Я Астра, помічниця месенджера NEXO. Чим допомогти?',
  'zh-CN': '你好！我是阿斯特拉，NEXO Messenger 的助手。有什么可以帮你？',
}
export const FISH_GREETING = FISH_GREETINGS.ru
export async function synthesizeFish(text, { key, fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl('https://api.fish.audio/v1/tts', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: 's2.1-pro-free' },
      body: JSON.stringify({ text, reference_id: FISH_VOICE_ID, format: 'mp3' }),
    })
    if (!response.ok || !response.body || !/^audio\//i.test(response.headers.get('content-type') || '')) return null
    const chunks = []; let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > 4 * 1024 * 1024) return null
      chunks.push(chunk)
    }
    return size ? Buffer.concat(chunks) : null
  } catch { return null }
}
