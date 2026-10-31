import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n, type TranslationKey } from '../i18n'
import * as api from '../lib/api'
import { IconBack, NexoMark } from '../components/icons'
import banner from '../assets/bot/zeron-store.png'

const nexProducts: api.ZeronProduct[] = ['nex_100', 'nex_500', 'nex_1000', 'nex_5000']

export default function ZeronBotPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [chat, setChat] = useState<api.ZeronChat | null>(null)
  const [busy, setBusy] = useState<api.ZeronAction | null>(null)
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    api.getZeronChat().then(data => { if (mounted.current) setChat(data) }).catch(() => { if (mounted.current) setError(t('zeron.unavailable')) })
    return () => { mounted.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [chat?.messages.length, busy])
  const product = (p: api.ZeronProduct | null) => p === 'premium_30' ? t('zeron.premium30') : p?.startsWith('nex_') ? `${Number(p.slice(4)).toLocaleString(locale)} NEX` : ''
  const act = async (action: api.ZeronAction) => {
    if (busy) return
    setBusy(action); setError(''); setCopyStatus('')
    try {
      const request = api.zeronAction(action)
      // Keep the real pending indicator visible briefly even on a fast server.
      const [result] = await Promise.all([request, action === 'continue' ? new Promise(resolve => setTimeout(resolve, 650)) : Promise.resolve()])
      if (mounted.current) setChat(result)
    } catch (e) {
      if (!mounted.current) return
      const code = e instanceof Error ? e.message : ''
      setError(t(code === 'ZERON_TEST_RESTRICTED' ? 'zeron.restricted' : code === 'ZERON_DAILY_LIMIT' ? 'zeron.limit' : 'zeron.error'))
      // Refresh restores the generated code if the response was interrupted.
      void api.getZeronChat().then(data => { if (mounted.current) setChat(data) }).catch(() => undefined)
    } finally { if (mounted.current) setBusy(null) }
  }
  const body = (message: api.ZeronMessage) => {
    if (message.role === 'user') {
      const commands: Record<string, string> = { start: '/start', back: '/menu', nex: '/nex', premium: '/premium', sbp: '/sbp', continue: '/continue' }
      return message.kind === 'select' ? product(message.product) : commands[message.kind] || ''
    }
    const keys: Record<string, TranslationKey> = { welcome: 'zeron.welcome', choose_nex: 'zeron.chooseNex', choose_premium: 'zeron.choosePremium', payment_test: 'zeron.payment', confirm_test: 'zeron.confirm', code: 'zeron.yourCode' }
    return t(keys[message.kind] || 'zeron.welcome', { product: product(message.product) })
  }
  const button = (action: api.ZeronAction, label: string) => <button type="button" className="zeron-menu-button" key={action} disabled={!!busy} onClick={() => void act(action)}>{label}</button>
  return <div className="room-wrap zeron-room">
    <div className="room-head zeron-head">
      <button className="icon-btn" onClick={() => navigate('/chats')} aria-label={t('common.back')}><IconBack size={19} /></button>
      <span className="ai-avatar"><NexoMark size={25} /></span>
      <span className="row-main"><strong>Zeron</strong><span className="row-preview">{t('zeron.subtitle')}</span></span>
    </div>
    <div className="zeron-verified" role="note"><span aria-hidden="true">✓</span> {t('zeron.verified')}</div>
    <div className="messages-scroll zeron-scroll" ref={scrollRef}>
      <div className="zeron-welcome glass"><img src={banner} alt="" /><div><strong>Zeron</strong><p>{t('zeron.welcome')}</p><p className="zeron-notice">{t('zeron.testNotice')}</p></div></div>
      {chat?.messages.map(message => <div className={`msg-row ${message.role === 'user' ? 'mine' : 'theirs'}`} key={message.id}>
        <div className="msg-col"><div className="bubble zeron-bubble">{body(message)}
          {message.kind === 'code' && message.code && <><code className="zeron-code">{message.code}</code><p>{t('zeron.redeemHint')}</p><button type="button" className="btn btn-sm" onClick={() => { if (!navigator.clipboard) { setCopyStatus(t('zeron.copyError')); return } void navigator.clipboard.writeText(message.code!).then(() => setCopyStatus(t('zeron.copied'))).catch(() => setCopyStatus(t('zeron.copyError'))) }}>{t('zeron.copy')}</button></>}
        </div></div>
      </div>)}
      {busy === 'continue' && <><div className="msg-row mine"><div className="bubble">/continue</div></div><div className="msg-row theirs"><div className="bubble zeron-loading" role="status">{t('zeron.generating', { product: product(chat?.selected || null) })}<span className="zeron-dots" aria-hidden="true">...</span></div></div></>}
      {copyStatus && <p role="status">{copyStatus}</p>}
      {error && <div className="zeron-error" role="alert">{error}</div>}
      {!chat && !error && <div className="center-loader"><div className="spinner" />{t('common.loading')}</div>}
      {chat && <div className="zeron-menu">
        {chat.stage === 'home' && <>
          {chat.messages.length === 0 && button('start', t('zeron.start'))}
          {button('nex', t('zeron.nex'))}{button('premium', t('zeron.premium'))}
          <button type="button" className="zeron-menu-button zeron-channel" onClick={() => navigate('/channel/c_zeron_official')}>{t('zeron.channel')}</button>
        </>}
        {chat.stage === 'nex' && <>{nexProducts.map(p => button(p, product(p)))}{button('back', t('zeron.back'))}</>}
        {chat.stage === 'premium' && <>{button('premium_30', product('premium_30'))}{button('back', t('zeron.back'))}</>}
        {chat.stage === 'payment' && <>{button('sbp', t('zeron.sbp'))}{button('back', t('zeron.back'))}</>}
        {chat.stage === 'confirm' && <>{chat.canIssue ? button('continue', t('zeron.continue')) : <p className="zeron-notice">{t('zeron.restricted')}</p>}{button('back', t('zeron.back'))}</>}
      </div>}
    </div>
  </div>
}
