/** OpenRouter adapter. Key stays on the server; no paid-model fallback. */
export const OPENROUTER_MODEL = 'qwen/qwen3-4b:free'
const MODEL_URL = 'https://openrouter.ai/api/v1/models/qwen/qwen3-4b:free/endpoints'
const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'

export function createOpenRouter({ fetchImpl = fetch, getKey, now = Date.now }) {
  let cached = null
  let checkedAt = 0
  return {
    async status() {
      if (!getKey()) return { ready: false, reason: 'missing_key' }
      if (cached && now() - checkedAt < 60000) return cached
      try {
        const response = await fetchImpl(MODEL_URL, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error('unavailable')
        const result = await response.json()
        const endpoints = result?.data?.endpoints
        if (!Array.isArray(endpoints)) throw new Error('invalid response')
        cached = endpoints.length ? { ready: true, reason: 'available' } : { ready: false, reason: 'model_unavailable' }
      } catch { cached = { ready: false, reason: 'network_error' } }
      checkedAt = now()
      return cached
    },
    async answer(messages) {
      const key = getKey()
      if (!key) return { error: 'AI_NOT_CONFIGURED' }
      try {
        const response = await fetchImpl(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(90000),
          body: JSON.stringify({ model: OPENROUTER_MODEL, messages, max_tokens: 512, stream: false,
            provider: { max_price: { prompt: 0, completion: 0, request: 0 } } }),
        })
        if (response.status === 429) return { error: 'AI_RATE_LIMIT' }
        if (response.status === 401 || response.status === 403) return { error: 'AI_AUTH_ERROR' }
        if (!response.ok) return { error: 'AI_UNAVAILABLE' }
        const result = await response.json()
        const answer = typeof result.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content.trim().slice(0, 6000) : ''
        return answer ? { answer } : { error: 'AI_UNAVAILABLE' }
      } catch { return { error: 'AI_UNAVAILABLE' } }
    },
  }
}
