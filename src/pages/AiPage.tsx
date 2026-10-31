import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n, type TranslationKey } from '../i18n'
import * as api from '../lib/api'
import { IconBack, IconSend, IconEdit, IconChats, NexoMark } from '../components/icons'
import Astra from '../components/Astra'

export default function AiPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(false)
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
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      const keys: Record<string, TranslationKey> = { AI_RATE_LIMIT: 'ai.rateLimit', AI_AUTH_ERROR: 'ai.authError', AI_FORBIDDEN: 'ai.forbidden', AI_CERT_ERROR: 'ai.certError', AI_NOT_CONFIGURED: 'ai.setup', AI_BUSY: 'ai.busy', AI_BALANCE: 'ai.balance', AI_DAILY_LIMIT: 'ai.dailyLimit' }
      setError(t(keys[code] || 'ai.sendError'))
    }
    finally { setSending(false) }
  }
  const newChat = () => { setThreadId(null); setMessages([]); setText(''); setError(''); setShowHistory(false) }
  const toggleHistory = async () => {
    if (showHistory) { setShowHistory(false); return }
    setLoadingHistory(true); setShowHistory(true); setError('')
    try { setThreads(await api.listAiThreads()) } catch { setError(t('ai.chatsError')) }
    finally { setLoadingHistory(false) }
  }
  const openThread = async (id: string) => {
    setLoadingHistory(true); setError('')
    try { const history = await api.getAiHistory(id); setThreadId(id); setMessages(history); setText(''); setShowHistory(false) }
    catch { setError(t('ai.historyError')) } finally { setLoadingHistory(false) }
  }
  const selectAstra = () => {
    setSelected(true)
    if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      try { const speech = new SpeechSynthesisUtterance(t('astra.hello')); speech.lang = locale; window.speechSynthesis.speak(speech) } catch { /* speech depends on the device */ }
    }
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
      <button className="icon-btn" disabled={sending || loadingHistory} onClick={() => void toggleHistory()} aria-label={t('ai.chats')} title={t('ai.chats')}><IconChats size={19} /></button>
      <button className="icon-btn" disabled={sending || loadingHistory} onClick={newChat} aria-label={t('ai.newChat')} title={t('ai.newChat')}><IconEdit size={19} /></button>
    </div>
    {showHistory && <div className="ai-history glass"><strong>{t('ai.chats')}</strong>{loadingHistory ? <p>{t('common.loading')}</p> : threads.length === 0 ? <p>{t('ai.noChats')}</p> : threads.map(thread => <button key={thread.id} className="btn btn-sm" disabled={sending || loadingHistory} onClick={() => void openThread(thread.id)}>{thread.title}</button>)}</div>}
    <div ref={scroller} className="messages-scroll ai-messages">
      <div className="astra-intro"><Astra greeting /><div className="astra-greeting glass">{t('astra.hello')}</div></div>
      <div className="ai-disclaimer glass">{t('ai.disclaimer')}</div>
      {status && !ready && <div className="ai-notice glass" role="status"><p>{t(status.reason === 'missing_key' ? 'ai.setup' : status.reason === 'invalid_cert' ? 'ai.certError' : status.reason === 'model_unavailable' ? 'ai.modelUnavailable' : status.reason === 'unsupported' ? 'ai.unsupported' : 'ai.networkError')}</p><button className="btn btn-sm" onClick={() => void check()}>{t('ai.retry')}</button></div>}
      {messages.length === 0 && <div className="ai-empty">{t('ai.welcome')}</div>}
      {messages.map(message => <div key={message.id} className={`msg-row ${message.role === 'user' ? 'mine' : 'theirs'}`}>
        <div className="msg-col"><div className="bubble ai-bubble">{message.content}</div><span className="ai-time">{new Date(message.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
      </div>)}
      {sending && <div className="msg-row theirs"><div className="bubble" role="status">{t('ai.thinking')}</div></div>}
    </div>
    {error && <div className="ai-error" role="alert">{error}</div>}
    <form className="ai-composer" onSubmit={event => { event.preventDefault(); void send() }}>
      <textarea className="input" value={text} onChange={event => setText(event.target.value)} placeholder={t('ai.placeholder')} maxLength={2000} rows={2} disabled={sending || ready !== true} aria-label={t('ai.placeholder')} />
      <button className="btn btn-primary" type="submit" disabled={sending || !text.trim() || ready !== true} aria-label={t('ai.send')}><IconSend size={19} /></button>
    </form>
  </div>
}
