/** Groq's OpenAI-compatible chat endpoint. The key never leaves the server. */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'
export const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

export function createGroq({ fetchImpl = fetch, getKey, baseUrl = DEFAULT_GROQ_BASE_URL, model = DEFAULT_GROQ_MODEL, timeoutMs = 30000 }) {
  let chatUrl
  try {
    const url = new URL(baseUrl)
    // Never send the bearer token to a different host, over HTTP, or through a redirect.
    if (url.protocol !== 'https:' || url.hostname !== 'api.groq.com' || url.port || url.username || url.password || url.search || url.hash) throw new Error('invalid URL')
    chatUrl = `${url.toString().replace(/\/$/, '')}/chat/completions`
  } catch { chatUrl = null }
  const timeout = Number(timeoutMs)
  const validConfig = !!chatUrl && typeof model === 'string' && !!model.trim() && Number.isInteger(timeout) && timeout >= 1000 && timeout <= 120000
  return {
    status() {
      if (!validConfig) return { ready: false, reason: 'invalid_config' }
      return getKey() ? { ready: true, reason: 'available' } : { ready: false, reason: 'missing_key' }
    },
    async answer(messages) {
      const key = getKey()
      if (!key) return { error: 'AI_NOT_CONFIGURED' }
      if (!validConfig) return { error: 'AI_UNAVAILABLE' }
      try {
        const response = await fetchImpl(chatUrl, {
          method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(timeout),
          body: JSON.stringify({ model, messages, max_completion_tokens: 1024, stream: false, ...(model === DEFAULT_GROQ_MODEL ? { reasoning_effort: 'low' } : {}) }),
        })
        if (response.status === 429) return { error: 'AI_RATE_LIMIT' }
        if (response.status === 401) return { error: 'AI_AUTH_ERROR' }
        if (response.status === 403) return { error: 'AI_FORBIDDEN' }
        if (!response.ok) return { error: 'AI_UNAVAILABLE' }
        const data = await response.json()
        const answer = typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content.trim().slice(0, 6000) : ''
        return answer ? { answer } : { error: 'AI_UNAVAILABLE' }
      } catch { return { error: 'AI_UNAVAILABLE' } }
    },
  }
}
