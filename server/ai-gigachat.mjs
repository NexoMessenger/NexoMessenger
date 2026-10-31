import { randomUUID, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rootCertificates } from 'node:tls'
import { Agent } from 'undici'

const AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions'
const SAFETY_MARGIN_MS = 60_000
const CERT_CODES = new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID'])
const statusError = status => status === 429 ? 'AI_RATE_LIMIT' : status === 401 ? 'AI_AUTH_ERROR' : status === 403 ? 'AI_FORBIDDEN' : 'AI_UNAVAILABLE'

/** OAuth credentials and access tokens exist only on the server, never in logs or the browser. */
export function createGigachat({ getKey, fetchImpl = fetch, now = Date.now, uuid = randomUUID, caFile, model = 'GigaChat', timeoutMs = 30000 }) {
  let dispatcher, certError = false
  if (caFile) {
    try {
      const pem = readFileSync(caFile, 'utf8')
      const certs = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)
      if (!certs?.length) throw new Error('No certificates')
      for (const cert of certs) new X509Certificate(cert)
      // Extra trust is restricted to this provider's dispatcher, not the whole Node process.
      dispatcher = new Agent({ connect: { ca: [...rootCertificates, ...certs] } })
    } catch { certError = true }
  }
  const timeout = Number(timeoutMs)
  const validConfig = typeof model === 'string' && !!model.trim() && Number.isInteger(timeout) && timeout >= 1000 && timeout <= 120000
  let cached = null, pending = null
  const networkError = error => CERT_CODES.has(error?.cause?.code) || CERT_CODES.has(error?.code) ? 'AI_CERT_ERROR' : 'AI_UNAVAILABLE'
  const options = () => ({ redirect: 'error', signal: AbortSignal.timeout(timeout), ...(dispatcher ? { dispatcher } : {}) })
  async function getToken(key) {
    if (cached && cached.key === key && now() < cached.expiresAt - SAFETY_MARGIN_MS) return { token: cached.token }
    if (pending && pending.key === key) return pending.promise
    const promise = (async () => {
      try {
        const response = await fetchImpl(AUTH_URL, {
          ...options(), method: 'POST',
          headers: { Authorization: `Basic ${key}`, RqUID: uuid(), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ scope: 'GIGACHAT_API_PERS' }).toString(),
        })
        if (!response.ok) return { error: statusError(response.status) }
        const body = await response.json()
        if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(body.expires_at) || body.expires_at <= now() + SAFETY_MARGIN_MS) return { error: 'AI_UNAVAILABLE' }
        cached = { key, token: body.access_token, expiresAt: Math.min(body.expires_at, now() + 30 * 60_000) }
        return { token: cached.token }
      } catch (error) { return { error: networkError(error) } }
    })()
    pending = { key, promise }
    try { return await promise } finally { if (pending?.promise === promise) pending = null }
  }
  return {
    status() {
      if (certError) return { ready: false, reason: 'invalid_cert' }
      if (!validConfig) return { ready: false, reason: 'invalid_config' }
      return getKey() ? { ready: true, reason: 'available' } : { ready: false, reason: 'missing_key' }
    },
    async answer(messages) {
      const key = getKey()
      if (!key) return { error: 'AI_NOT_CONFIGURED' }
      if (certError) return { error: 'AI_CERT_ERROR' }
      if (!validConfig) return { error: 'AI_UNAVAILABLE' }
      for (let attempt = 0; attempt < 2; attempt++) {
        const auth = await getToken(key)
        if (auth.error) return auth
        try {
          const response = await fetchImpl(CHAT_URL, {
            ...options(), method: 'POST',
            headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 384, stream: false }),
          })
          if (response.status === 401 && attempt === 0) {
            if (cached?.token === auth.token) cached = null
            continue
          }
          if (!response.ok) return { error: statusError(response.status) }
          const data = await response.json()
          const answer = typeof data.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content.trim().slice(0, 6000) : ''
          return answer ? { answer } : { error: 'AI_UNAVAILABLE' }
        } catch (error) { return { error: networkError(error) } }
      }
      return { error: 'AI_AUTH_ERROR' }
    },
  }
}
