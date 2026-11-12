import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import type { Profile } from './types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  greeting: 'new' | 'login' | 'session' | null
  dismissGreeting: () => void
  email: string | null
}

const Ctx = createContext<AuthState>({ profile: null, loading: true, refresh: async () => undefined, signOut: async () => undefined, greeting: null, dismissGreeting: () => undefined, email: null })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const idRef = useRef<string | null>(null)
  const shown = useRef(false)
  const [greeting, setGreeting] = useState<'new' | 'login' | 'session' | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const p = await api.getCurrentProfile()
      idRef.current = p?.id ?? null
      // Polling returns a new object each time; retain the reference when nothing changed.
      setProfile(previous => JSON.stringify(previous) === JSON.stringify(p) ? previous : p)
      if (p && !shown.current) {
        shown.current = true
        let event: string | null = null
        try { event = sessionStorage.getItem('nexo_auth_event'); sessionStorage.removeItem('nexo_auth_event') } catch { /* storage unavailable */ }
        setGreeting(event === 'new' || event === 'login' ? event : 'session')
        api.getCurrentEmail().then(value => { if (idRef.current === p.id) setEmail(value) }).catch(() => undefined)
      }
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const unsub = api.onAuthChange(() => { refresh() })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restrictions can be changed while the user is already signed in.
  useEffect(() => {
    if (!profile || api.mode !== 'server') return
    const timer = window.setInterval(() => { void refresh() }, 10000)
    return () => window.clearInterval(timer)
  }, [profile?.id])

  // Presence heartbeat + honest offline marking when the tab closes.
  useEffect(() => {
    if (!profile) return
    const id = profile.id
    api.setPresence(id, true).catch(() => undefined)
    const iv = setInterval(() => { api.setPresence(id, true).catch(() => undefined) }, 45000)
    const off = () => { api.setPresence(id, false).catch(() => undefined) }
    window.addEventListener('beforeunload', off)
    return () => { clearInterval(iv); window.removeEventListener('beforeunload', off) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Apply saved theme
  useEffect(() => {
    if (!profile) return
    api.getSettings(profile.id).then((s) => {
      document.documentElement.dataset.theme = s.theme
      try { localStorage.setItem('nexo_theme', s.theme) } catch { /* ignore */ }
    }).catch(() => undefined)
  }, [profile])

  const signOut = async () => {
    await api.signOutUser()
    idRef.current = null
    shown.current = false
    setGreeting(null)
    setEmail(null)
    setProfile(null)
  }

  return <Ctx.Provider value={{ profile, loading, refresh, signOut, greeting, dismissGreeting: () => setGreeting(null), email }}>{children}</Ctx.Provider>
}
