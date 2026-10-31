import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

try {
  const cachedTheme = localStorage.getItem('nexo_theme')
  if (cachedTheme) document.documentElement.dataset.theme = cachedTheme
} catch { /* ignore */ }

async function detectSameOriginServer() {
  const apiBaseEnv = import.meta.env.VITE_API_BASE as string | undefined
  if (apiBaseEnv !== undefined) return
  if (!/^https?:$/.test(window.location.protocol)) return

  try {
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 1800)
    const res = await fetch('/api/health', {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    })
    window.clearTimeout(timer)
    const data = res.ok ? await res.json().catch(() => null) : null
    if ((data as { mode?: string } | null)?.mode === 'server') {
      window.sessionStorage.setItem('nexo_backend_mode', 'server')
    } else {
      window.sessionStorage.removeItem('nexo_backend_mode')
    }
  } catch {
    try { window.sessionStorage.removeItem('nexo_backend_mode') } catch { /* ignore */ }
  }
}

async function finishGoogleSignIn() {
  const url = new URL(window.location.href)
  if (url.searchParams.get('google_auth') !== 'complete') return
  let result = 'error'
  try {
    const response = await fetch('/api/auth/google/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' })
    const data = await response.json() as { token?: string; error?: string; isNew?: boolean }
    if (response.ok && data.token) {
      // This is the existing NEXO session token, not a Google OAuth token.
      try { sessionStorage.setItem('nexo_auth_event', data.isNew ? 'new' : 'login') } catch { /* optional */ }
      localStorage.setItem('nexo_server_token', data.token)
      result = 'success'
    } else if (data.error === 'GOOGLE_EMAIL_EXISTS') result = 'conflict'
  } catch { /* Show an honest error and retain any existing session. */ }
  url.searchParams.delete('google_auth')
  if (result !== 'success') url.searchParams.set('google_auth', result)
  url.hash = result === 'success' ? '#/' : '#/login'
  history.replaceState(null, '', url.pathname + url.search + url.hash)
}

async function start() {
  await detectSameOriginServer()
  await finishGoogleSignIn()
  const { default: App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void start()
