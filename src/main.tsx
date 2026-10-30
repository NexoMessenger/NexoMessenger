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

async function start() {
  await detectSameOriginServer()
  const { default: App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void start()
