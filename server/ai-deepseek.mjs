/** Paid DeepSeek adapter: credentials stay on the server. */
export const DEEPSEEK_MODEL = 'deepseek-flash'
const CHAT_URL = 'https://api.deepseek.com/chat/completions'
export function createDeepSeek({ fetchImpl = fetch, getKey }) {
  return {
    status() { return getKey() ? { ready: true, reason: 'available' } : { ready: false, reason: 'missing_key' } },
    async answer(messages) {
      const key = getKey()
      if (!key) return { error: 'AI_NOT_CONFIGURED' }
      try {
        const response = await fetchImpl(CHAT_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, max_tokens: 384, stream: false, thinking: { type: 'disabled' } }),
        })
        if (response.status === 402) return { error: 'AI_BALANCE' }
        if (response.status === 429) return { error: 'AI_RATE_LIMIT' }
        if (response.status === 401 || response.status === 403) return { error: 'AI_AUTH_ERROR' }
        if (!response.ok) return { error: 'AI_UNAVAILABLE' }
        const data = await response.json()
        const answer = typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content.trim().slice(0, 6000) : ''
        return answer ? { answer } : { error: 'AI_UNAVAILABLE' }
      } catch { return { error: 'AI_UNAVAILABLE' } }
    },
  }
}
