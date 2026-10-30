import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import * as api from '../lib/api'
import { IconBack, IconSend, NexoMark } from '../components/icons'

export default function AiPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [ready, setReady] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<api.AiMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const check = async () => {
    setReady(null); setError('')
    try { setReady(await api.getAiStatus()) } catch { setReady(false) }
  }
  useEffect(() => {
    void check()
    api.getAiHistory().then(setMessages).catch(() => setError(t('ai.historyError')))
  }, [])
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }) }, [messages, sending])
  const send = async () => {
    const question = text.trim()
    if (!question || sending || !ready) return
    setSending(true); setError('')
    try {
      const pair = await api.askAi(question)
      setMessages(prev => [...prev, ...pair].slice(-100)); setText('')
    } catch { setError(t('ai.sendError')) }
    finally { setSending(false) }
  }
  return <div className="room-wrap ai-room">
    <div className="room-head">
      <button className="icon-btn" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={19} /></button>
      <span className="ai-avatar"><NexoMark size={25} /></span>
      <span className="row-main"><strong>NEXO AI</strong><span className="row-preview">{ready === null ? t('ai.checking') : ready ? t('ai.ready') : t('ai.unavailable')}</span></span>
    </div>
    <div ref={scroller} className="messages-scroll ai-messages">
      <div className="ai-disclaimer glass">{t('ai.disclaimer')}</div>
      {ready === false && <div className="ai-notice glass" role="status"><p>{t('ai.setup')}</p><button className="btn btn-sm" onClick={() => void check()}>{t('ai.retry')}</button></div>}
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
