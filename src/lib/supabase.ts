import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabase = Boolean(url && anon && url.startsWith('http'))

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/**
 * Website (self-hosted server) mode: when the build sets VITE_API_BASE
 * ('same-origin' when the NEXO server serves this frontend itself, or an
 * absolute API origin), ALL data/sessions/files live on that server —
 * see server/index.mjs. This takes priority over Supabase/local demo.
 */
const apiBaseEnv = import.meta.env.VITE_API_BASE as string | undefined

/**
 * Runtime safety net: main.tsx probes same-origin /api/health before the app
 * modules load. If the real NEXO server answers on this origin, a frontend
 * bundle that was built without VITE_API_BASE must still use server mode —
 * never the browser-only Local Demo — on the public website.
 */
const runtimeServer = (() => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('nexo_backend_mode') === 'server'
  } catch {
    return false
  }
})()

export const hasServer = apiBaseEnv !== undefined || runtimeServer
export const apiBase = apiBaseEnv === 'same-origin' ? '' : (apiBaseEnv || '')

/** "server" = own website server, "supabase" = Supabase keys, else local demo. */
export const backendMode: 'server' | 'supabase' | 'local' = hasServer ? 'server' : hasSupabase ? 'supabase' : 'local'
