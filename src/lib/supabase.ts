import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabase = Boolean(url && anon && url.startsWith('http'))

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** "supabase" when env keys are present, otherwise the clearly-labelled local demo backend. */
export const backendMode: 'supabase' | 'local' = hasSupabase ? 'supabase' : 'local'
