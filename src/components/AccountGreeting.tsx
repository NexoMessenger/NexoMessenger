import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { NexoMark } from './icons'
import type { TranslationKey } from '../i18n/translations'

const steps: { target: string; title: TranslationKey; text: TranslationKey }[] = [
  { target: 'chats', title: 'tour.chats', text: 'tour.chatsText' },
  { target: 'groups', title: 'tour.groups', text: 'tour.groupsText' },
  { target: 'channels', title: 'tour.channels', text: 'tour.channelsText' },
  { target: 'gifts', title: 'tour.gifts', text: 'tour.giftsText' },
  { target: 'profile', title: 'tour.profile', text: 'tour.profileText' },
]

type Point = { x: number; y: number; w: number; h: number }
export default function AccountGreeting() {
  const { profile, email, greeting, dismissGreeting } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tour, setTour] = useState(-1)
  const [target, setTarget] = useState<Point | null>(null)
  const [toastVisible, setToastVisible] = useState(true)
  useEffect(() => {
    if (greeting !== 'session') return
    setToastVisible(true)
    const timer = window.setTimeout(() => { setToastVisible(false); dismissGreeting() }, 7000)
    return () => window.clearTimeout(timer)
  // dismissGreeting changes on refresh; the timer should not restart.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting, profile?.id])
  useEffect(() => { if (!profile) setTour(-1) }, [profile])
  useLayoutEffect(() => {
    if (tour < 0) return
    const measure = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${steps[tour].target}"]`))
      const rect = candidates.map(el => el.getBoundingClientRect()).find(r => r.width > 0 && r.height > 0)
      setTarget(rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null)
    }
    measure(); const timer = window.setTimeout(measure, 120)
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [tour])
  if (!profile) return null
  const finish = () => { setTour(-1); dismissGreeting() }
  const startTour = () => { navigate('/chats'); setTour(0) }
  if (tour >= 0) {
    const step = steps[tour]
    // The arrow bends from the central card toward the visible navigation target.
    const endX = target ? target.x + target.w / 2 : 0
    const endY = target ? target.y + target.h / 2 : 0
    const startX = window.innerWidth / 2
    const startY = window.innerHeight / 2 + (endY > window.innerHeight / 2 ? 85 : -85)
    return <div className="onboarding-tour" role="dialog" aria-modal="true" aria-label={t('tour.title')}>
      {target && <><div className="onboarding-highlight" style={{ left: target.x - 4, top: target.y - 4, width: target.w + 8, height: target.h + 8 }} />
        <svg className="onboarding-arrow" aria-hidden="true" width="100%" height="100%"><defs><marker id="tour-arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#d6bdff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></marker></defs><path d={`M ${startX} ${startY} C ${startX + 95} ${(startY + endY) / 2}, ${endX + 80} ${(startY + endY) / 2}, ${endX} ${endY}`} fill="none" stroke="#d6bdff" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#tour-arrowhead)" /></svg></>}
      <div className="onboarding-card tour-card"><div className="onboarding-eyebrow">{t('tour.title')} · {tour + 1} / {steps.length}</div><h2>{t(step.title)}</h2><p>{t(step.text)}</p><div className="onboarding-actions"><button className="onboarding-skip" onClick={finish}>{t('tour.skip')}</button><button className="btn btn-primary" onClick={() => tour === steps.length - 1 ? finish() : setTour(tour + 1)}>{tour === steps.length - 1 ? t('tour.done') : t('tour.next')}</button></div></div>
    </div>
  }
  if (greeting === 'session' && toastVisible) return <div className="session-toast" role="status"><div className="session-toast-icon"><NexoMark size={22} /></div><div className="session-toast-content"><strong>{t('greeting.session')}</strong><span>@{profile.username}</span><small>{email || t('greeting.emailUnavailable')}</small><small>{t('greeting.sessionNote')}</small></div><button onClick={finish} aria-label={t('tour.close')}>×</button><div className="session-progress" /></div>
  if (greeting !== 'new' && greeting !== 'login') return null
  return <div className="onboarding-full" role="dialog" aria-modal="true" aria-labelledby="greeting-title"><div className="onboarding-card"><div className="onboarding-logo"><NexoMark size={42} /></div><div className="onboarding-eyebrow">NEXO MESSENGER</div><h1 id="greeting-title">{greeting === 'new' ? t('greeting.welcome') : t('greeting.back')}<br /><span>{greeting === 'new' ? profile.display_name || profile.username : `@${profile.username}`}</span></h1><p>{greeting === 'new' ? t('greeting.intro') : t('greeting.backText')}</p>{greeting === 'new' && <div className="onboarding-features"><span>{t('tour.chats')}</span><span>{t('tour.groups')}</span><span>{t('tour.channels')}</span><span>{t('tour.gifts')}</span></div>}<div className="onboarding-buttons">{greeting === 'new' ? <><button className="btn btn-primary" onClick={startTour}>{t('tour.start')}</button><button className="onboarding-skip" onClick={finish}>{t('tour.skip')}</button></> : <button className="btn btn-primary" onClick={finish}>{t('tour.continue')}</button>}</div></div></div>
}
