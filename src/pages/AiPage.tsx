import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n, type TranslationKey } from '../i18n'
import * as api from '../lib/api'
import { IconBack, IconSend, IconEdit, IconChats, IconVolume, NexoMark } from '../components/icons'
import Astra from '../components/Astra'
import { useAstraVoice } from '../lib/astraVoice'

export default function AiPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState(false)
  const voice = useAstraVoice(locale)
  const [fishAvailable, setFishAvailable] = useState(false)
  const [fishPlaying, setFishPlaying] = useState(false)
  const [cloudVoice, setCloudVoice] = useState(() => { try { return localStorage.getItem('nexo_astra_cloud_voice') === 'true' } catch { return false } })
  const [fishError, setFishError] = useState(false)
  const cloudRef = useRef(cloudVoice)
  const voiceEnabledRef = useRef(voice.enabled)
  const fishAvailableRef = useRef(fishAvailable)
  cloudRef.current = cloudVoice; voiceEnabledRef.current = voice.enabled; fishAvailableRef.current = fishAvailable
  const mounted = useRef(true)
  const fishRequest = useRef<AbortController | null>(null)
  const fishAudio = useRef<HTMLAudioElement | null>(null)
  const fishUrl = useRef<string | null>(null)
  const stopFish = () => {
    fishRequest.current?.abort(); fishRequest.current = null
    fishAudio.current?.pause(); fishAudio.current = null
    if (fishUrl.current) URL.revokeObjectURL(fishUrl.current)
    fishUrl.current = null; setFishPlaying(false)
  }
  const playFish = async (id: string, replace = false) => {
    if (!mounted.current) return
    if (fishPlaying && !replace) { stopFish(); return }
    voice.stop(); stopFish(); setFishError(false); setFishPlaying(true)
    const controller = new AbortController(); fishRequest.current = controller
    try {
      const blob = await api.fishVoice(id, locale, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob); fishUrl.current = url
      const audio = new Audio(url); fishAudio.current = audio
      audio.onended = () => stopFish()
      audio.onerror = () => { stopFish(); setFishError(true) }
      await audio.play()
    } catch { if (!controller.signal.aborted) { stopFish(); setFishError(true) } }
  }
  useEffect(() => {
    mounted.current = true
    void api.fishVoiceAvailable().then(setFishAvailable).catch(() => setFishAvailable(false))
    return () => { mounted.current = false; fishRequest.current?.abort(); fishAudio.current?.pause(); if (fishUrl.current) URL.revokeObjectURL(fishUrl.current) }
  }, [])
  const [status, setStatus] = useState<api.AiStatus | null>(null)
  const ready = status?.ready === true
  const [threadId, setThreadId] = useState<string | null>(null)
  const [threads, setThreads] = useState<api.AiThread[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [messages, setMessages] = useState<api.AiMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const check = async () => {
    setStatus(null); setError('')
    try { setStatus(await api.getAiStatus()) } catch { setStatus({ ready: false, reason: 'network_error' }) }
  }
  useEffect(() => {
    void check()
  }, [])
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }) }, [messages, sending])
  const send = async () => {
    const question = text.trim()
    if (!question || sending || !ready) return
    setSending(true); setError('')
    try {
      const response = await api.askAi(question, threadId)
      setThreadId(response.thread_id); setMessages(prev => [...prev, ...response.messages].slice(-100)); setText('')
      const answer = [...response.messages].reverse().find(message => message.role === 'assistant')
      if (answer && mounted.current) {
        if (cloudRef.current && fishAvailableRef.current && voiceEnabledRef.current) void playFish(answer.id, true)
        else if (!cloudRef.current) { stopFish(); voice.speak(answer.content) }
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      const keys: Record<string, TranslationKey> = { AI_RATE_LIMIT: 'ai.rateLimit', AI_AUTH_ERROR: 'ai.authError', AI_FORBIDDEN: 'ai.forbidden', AI_CERT_ERROR: 'ai.certError', AI_NOT_CONFIGURED: 'ai.setup', AI_BUSY: 'ai.busy', AI_BALANCE: 'ai.balance', AI_DAILY_LIMIT: 'ai.dailyLimit', AI_SERVER_DAILY_LIMIT: 'ai.serverDailyLimit', AI_ATTEMPT_LIMIT: 'ai.attemptLimit' }
      setError(t(keys[code] || 'ai.sendError'))
    }
    finally { setSending(false) }
  }
  const newChat = () => { stopFish(); voice.stop(); setThreadId(null); setMessages([]); setText(''); setError(''); setShowHistory(false) }
  const toggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return }
    setLoadingHistory(true); setShowHistory(true); setError('')
    try { setThreads(await api.listAiThreads()) } catch { setError(t('ai.chatsError')) }
    finally { setLoadingHistory(false) }
  }
  const openThread = async (id: string) => {
    stopFish(); voice.stop(); setLoadingHistory(true); setError('')
    try { const history = await api.getAiHistory(id); setThreadId(id); setMessages(history); setText(''); setShowHistory(false) }
    catch { setError(t('ai.historyError')) } finally { setLoadingHistory(false) }
  }
  const selectAstra = () => {
    setSelected(true)
    if (cloudVoice && fishAvailable && voice.enabled) void playFish('greeting', true)
    else if (!cloudVoice) voice.speak(t('astra.hello'))
  }
  if (!selected) return <div className="room-wrap astra-picker">
    <div className="room-head"><button className="icon-btn" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={19} /></button><strong>{t('astra.choose')}</strong></div>
    <div className="astra-picker-content"><div className="astra-choice glass"><Astra /><h2>{t('astra.name')}</h2><p>{t('astra.description')}</p><button className="btn btn-primary" onClick={selectAstra}>{t('astra.select')}</button></div></div>
  </div>
  return <div className="room-wrap ai-room">
    <div className="room-head">
      <button className="icon-btn" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={19} /></button>
      <span className="ai-avatar"><NexoMark size={25} /></span>
      <span className="row-main"><strong>{t('astra.name')}</strong><span className="row-preview">{status === null ? t('ai.checking') : ready ? t('ai.ready') : t('ai.unavailable')}</span></span>
      <button className="icon-btn" onClick={() => setVoiceSettings(v => !v)} aria-expanded={voiceSettings} aria-label={t('voice.settings')} title={t('voice.settings')}><IconVolume size={19} /></button>
      <button className="icon-btn" disabled={sending || loadingHistory} onClick={() => void toggleHistory()} aria-label={t('ai.chats')} title={t('ai.chats')}><IconChats size={19} /></button>
      <button className="icon-btn" disabled={sending || loadingHistory} onClick={newChat} aria-label={t('ai.newChat')} title={t('ai.newChat')}><IconEdit size={19} /></button>
    </div>
    {voiceSettings && <section className="astra-voice-settings glass" aria-label={t('voice.settings')}>
      <div className="astra-voice-top"><strong>{t('voice.settings')}</strong><label className="astra-voice-toggle"><input type="checkbox" checked={voice.enabled} disabled={!voice.supported && !fishAvailable} onChange={e => { voiceEnabledRef.current = e.target.checked; voice.setEnabled(e.target.checked); if (!e.target.checked) stopFish() }} /> {t('voice.auto')}</label></div>
      {(fishAvailable || cloudVoice) && <><p>{t('voice.cloudInfo')}</p><label className="astra-voice-toggle"><input type="checkbox" checked={cloudVoice} onChange={e => { const value = e.target.checked; cloudRef.current = value; stopFish(); voice.stop(); setCloudVoice(value); try { localStorage.setItem('nexo_astra_cloud_voice', String(value)) } catch { /* preference optional */ } }} /> {t('voice.cloudEnable')}</label><p>{t('voice.cloudLimit')}</p></>}
      {cloudVoice && !fishAvailable ? <p role="status">{t('voice.cloudError')}</p> : cloudVoice && fishAvailable ? <button type="button" className="btn btn-sm" onClick={() => void playFish('greeting')}>{fishPlaying ? t('voice.stop') : t('voice.preview')}</button> : !voice.supported ? <p role="status">{t('voice.unsupported')}</p> : <>
        <p>{t('voice.deviceInfo')}</p>
        <label htmlFor="astra-voice-select">{t('voice.choose')}</label>
        <div className="astra-voice-controls"><select id="astra-voice-select" className="input" value={voice.voices.some(v => v.voiceURI === voice.voiceURI) ? voice.voiceURI : ''} onChange={e => voice.selectVoice(e.target.value)}>
          <option value="">{t('voice.automatic')}</option>{voice.voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
        </select><button type="button" className="btn btn-sm" onClick={() => voice.speaking ? voice.stop() : (stopFish(), voice.speak(t('astra.hello'), true))}>{voice.speaking ? t('voice.stop') : t('voice.preview')}</button></div>
        {voice.voices.length === 0 && <p role="status">{t('voice.noVoices')}</p>}
      </>}
    </section>}

    {showHistory && <div className="ai-history glass"><strong>{t('ai.chats')}</strong>{loadingHistory ? <p>{t('common.loading')}</p> : threads.length === 0 ? <p>{t('ai.noChats')}</p> : threads.map(thread => <button key={thread.id} className="btn btn-sm" disabled={sending || loadingHistory} onClick={() => void openThread(thread.id)}>{thread.title}</button>)}</div>}
    <div ref={scroller} className="messages-scroll ai-messages">
      <div className="astra-intro"><Astra greeting /><div className="astra-greeting glass">{t('astra.hello')}{((voice.supported && !cloudVoice) || (fishAvailable && cloudVoice)) && <button type="button" className="astra-voice-replay" onClick={() => cloudVoice && fishAvailable ? void playFish('greeting') : voice.speaking ? voice.stop() : (stopFish(), voice.speak(t('astra.hello'), true))} aria-label={(voice.speaking || fishPlaying) ? t('voice.stop') : t('voice.playGreeting')} title={(voice.speaking || fishPlaying) ? t('voice.stop') : t('voice.playGreeting')}><IconVolume size={17} /></button>}</div></div>
      <div className="ai-disclaimer glass">{t('ai.disclaimer')}</div>
      {status && !ready && <div className="ai-notice glass" role="status"><p>{t(status.reason === 'missing_key' ? 'ai.setup' : status.reason === 'invalid_cert' ? 'ai.certError' : status.reason === 'model_unavailable' ? 'ai.modelUnavailable' : status.reason === 'unsupported' ? 'ai.unsupported' : 'ai.networkError')}</p><button className="btn btn-sm" onClick={() => void check()}>{t('ai.retry')}</button></div>}
      {messages.length === 0 && <div className="ai-empty">{t('ai.welcome')}</div>}
      {messages.map(message => <div key={message.id} className={`msg-row ${message.role === 'user' ? 'mine' : 'theirs'}`}>
        <div className="msg-col"><div className="bubble ai-bubble">{message.content}{message.role === 'assistant' && fishAvailable && cloudVoice && <button type="button" className="astra-voice-replay" onClick={() => void playFish(message.id)} aria-label={fishPlaying ? t('voice.stop') : t('voice.fishAnswer')} title={fishPlaying ? t('voice.stop') : t('voice.fishAnswer')}><IconVolume size={16} /></button>}{message.role === 'assistant' && !cloudVoice && voice.supported && <button type="button" className="astra-voice-replay" onClick={() => voice.speaking ? voice.stop() : (stopFish(), voice.speak(message.content, true))} aria-label={voice.speaking ? t('voice.stop') : t('voice.playAnswer')} title={voice.speaking ? t('voice.stop') : t('voice.playAnswer')}><IconVolume size={16} /></button>}</div><span className="ai-time">{new Date(message.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>)}
      {sending && <div className="msg-row theirs"><div className="bubble" role="status">{t('ai.thinking')}</div></div>}
    </div>
    {fishError && <div className="ai-error" role="alert">{t('voice.cloudError')}</div>}
    {voice.failed && <div className="ai-error" role="alert">{t('voice.failed')}</div>}
    {error && <div className="ai-error" role="alert">{error}</div>}
    <form className="ai-composer" onSubmit={event => { event.preventDefault(); void send() }}>
      <textarea className="input" value={text} onChange={event => setText(event.target.value)} placeholder={t('ai.placeholder')} maxLength={2000} rows={2} disabled={sending || ready !== true} aria-label={t('ai.placeholder')} />
      <button className="btn btn-primary" type="submit" disabled={sending || !text.trim() || ready !== true} aria-label={t('ai.send')}><IconSend size={19} /></button>
    </form>
  </div>
}
