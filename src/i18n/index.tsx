import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { dictionaries, LOCALES, type Locale, type TranslationKey } from './translations'
export type { Locale, TranslationKey } from './translations'
export { LOCALES } from './translations'
import { useAuth } from '../lib/AuthContext'
import * as api from '../lib/api'

const STORAGE_KEY = 'nexo_language'

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES.some((l) => l.code === saved)) return saved as Locale
  } catch { /* ignore */ }
  const nav = (navigator.language || 'en').toLowerCase()
  if (nav.startsWith('ru')) return 'ru'
  if (nav.startsWith('uk')) return 'uk'
  if (nav.startsWith('zh')) return 'zh-CN'
  return 'en'
}

interface I18nState {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string>) => string
}

const Ctx = createContext<I18nState>({
  locale: 'en',
  setLocale: () => undefined,
  t: (k) => dictionaries.en[k] ?? k,
})

export const useI18n = () => useContext(Ctx)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale())
  const { profile } = useAuth()
  const syncedFor = useRef<string | null>(null)

  const t = (key: TranslationKey, vars?: Record<string, string>) => {
    let s = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v) })
    return s
  }

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    // Sync to the account when signed in (user_settings.language, migration 002).
    if (profile) api.updateSettings(profile.id, { language: l }).catch(() => undefined)
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // On sign-in, the account preference (if any) wins, per "sync with profile".
  useEffect(() => {
    if (!profile || syncedFor.current === profile.id) return
    syncedFor.current = profile.id
    api.getSettings(profile.id).then((s) => {
      const lang = (s as { language?: string }).language
      if (lang && LOCALES.some((l) => l.code === lang)) {
        setLocaleState(lang as Locale)
        try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
      }
    }).catch(() => undefined)
  }, [profile])

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}
