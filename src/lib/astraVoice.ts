import { useCallback, useEffect, useRef, useState } from 'react'

const ENABLED_KEY = 'nexo_astra_voice_enabled'
const VOICE_KEY = 'nexo_astra_voice_uri'
const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string) => { try { localStorage.setItem(key, value) } catch { /* voice preferences are optional */ } }

/** Split long answers so Android speech engines do not truncate long utterances. */
export function speechChunks(text: string, limit = 180): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const parts: string[] = []; let current = ''
  for (const word of words) {
    const characters = Array.from(word)
    if (characters.length > limit) {
      if (current) { parts.push(current); current = '' }
      for (let i = 0; i < characters.length; i += limit) parts.push(characters.slice(i, i + limit).join(''))
    } else if ((current + ' ' + word).trim().length > limit) {
      if (current) parts.push(current)
      current = word
    } else current = current ? `${current} ${word}` : word
  }
  if (current) parts.push(current)
  return parts
}

/** Prefer known softer/feminine device voices, without promising voice gender. */
export function voicesForLanguage(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice[] {
  const lang = locale.toLowerCase().split('-')[0]
  const priority = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase()
    if (/female|женск|женский|milena|milana|katya|катя|irina|ирина|samantha|zira|sofia|anna|алина|мария/.test(name)) return 0
    if (/male|мужск|мужской/.test(name)) return 2
    return 1
  }
  return voices.filter(v => v.lang.toLowerCase().split('-')[0] === lang).sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name))
}

export function useAstraVoice(locale: string) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  const [enabled, setEnabledState] = useState(() => read(ENABLED_KEY) !== 'false')
  const [voiceURI, setVoiceURI] = useState(() => read(VOICE_KEY) || '')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState(false)
  const alive = useRef(true)
  const serial = useRef(0)
  const current = useRef<SpeechSynthesisUtterance | null>(null)
  const isEnabled = useRef(enabled)
  const chosen = useRef(voiceURI)
  const available = useRef(voices)
  isEnabled.current = enabled; chosen.current = voiceURI; available.current = voices

  const stop = useCallback(() => {
    serial.current++
    if (supported) window.speechSynthesis.cancel()
    current.current = null
    setSpeaking(false)
  }, [supported])
  useEffect(() => {
    alive.current = true
    if (!supported) return () => { alive.current = false }
    const synth = window.speechSynthesis
    const load = () => setVoices(synth.getVoices())
    load(); synth.addEventListener('voiceschanged', load)
    return () => { alive.current = false; serial.current++; synth.cancel(); current.current = null; synth.removeEventListener('voiceschanged', load) }
  }, [supported])
  const setEnabled = (value: boolean) => {
    isEnabled.current = value; setEnabledState(value); write(ENABLED_KEY, String(value)); setFailed(false)
    if (!value) stop()
  }
  const selectVoice = (value: string) => { chosen.current = value; setVoiceURI(value); write(VOICE_KEY, value); stop(); setFailed(false) }
  const speak = (text: string, force = false) => {
    if (!alive.current || !supported || (!isEnabled.current && !force)) return
    const chunks = speechChunks(text)
    if (!chunks.length) return
    stop(); setFailed(false); setSpeaking(true)
    const sequence = serial.current
    const options = voicesForLanguage(available.current, locale)
    const voice = options.find(v => v.voiceURI === chosen.current) || options[0]
    const next = (index: number) => {
      if (sequence !== serial.current) return
      if (index >= chunks.length) { current.current = null; setSpeaking(false); return }
      try {
        const utterance = new SpeechSynthesisUtterance(chunks[index])
        current.current = utterance
        utterance.lang = locale
        if (voice) utterance.voice = voice
        utterance.rate = 0.96
        utterance.pitch = 1.12
        utterance.onend = () => next(index + 1)
        utterance.onerror = event => {
          if (sequence !== serial.current) return
          current.current = null; setSpeaking(false)
          if (event.error !== 'canceled' && event.error !== 'interrupted') setFailed(true)
        }
        window.speechSynthesis.speak(utterance)
      } catch { current.current = null; setSpeaking(false); setFailed(true) }
    }
    next(0)
  }
  return { supported, enabled, setEnabled, voiceURI, selectVoice, voices: voicesForLanguage(voices, locale), speaking, failed, speak, stop }
}
