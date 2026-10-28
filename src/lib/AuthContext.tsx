import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import type { Profile } from './types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({ profile: null, loading: true, refresh: async () => undefined, signOut: async () => undefined })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const idRef = useRef<string | null>(null)

  const refresh = async () => {
    try {
      const p = await api.getCurrentProfile()
      idRef.current = p?.id ?? null
      setProfile(p)
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
    }).catch(() => undefined)
  }, [profile])

  const signOut = async () => {
    await api.signOutUser()
    idRef.current = null
    setProfile(null)
  }

  return <Ctx.Provider value={{ profile, loading, refresh, signOut }}>{children}</Ctx.Provider>
}
