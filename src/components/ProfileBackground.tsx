import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PROFILE_BACKGROUNDS, type ProfileBackground as BackgroundId } from '../lib/profileBackgrounds'

/** Decorative only. Videos pause when off-screen or motion is reduced. */
export function ProfileBackground({ value, premiumActive = false }: { value?: BackgroundId; premiumActive?: boolean }) {
  const config = PROFILE_BACKGROUNDS.find(item => item.id === value && (!item.premium || premiumActive))
  const holder = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [value])
  useEffect(() => {
    const element = video.current, container = holder.current
    if (!element || !container || !config?.video) return
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let visible = false
    const sync = () => {
      if (visible && !motion?.matches && !document.hidden) void element.play().catch(() => undefined)
      else element.pause()
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => { visible = Boolean(entries[0]?.isIntersecting); sync() }, { threshold: .05 }) : null
    if (observer) observer.observe(container); else { visible = true; sync() }
    motion?.addEventListener?.('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { observer?.disconnect(); motion?.removeEventListener?.('change', sync); document.removeEventListener('visibilitychange', sync); element.pause() }
  }, [config?.id, failed])
  if (!config) return null
  const custom = !config.video
  return <div className={`profile-backdrop profile-backdrop-${config.id}`} ref={holder} aria-hidden="true">
    <div className="profile-backdrop-still" style={{ backgroundImage: `url(${config.poster})` }} />
    {config.video && !failed && <video ref={video} src={config.video} poster={config.poster} muted loop playsInline preload="none" onError={() => setFailed(true)} />}
    {config.id === 'storm_field' && <div className="profile-storm-flash"><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><path className="profile-lightning-bolt" d="M52 -3 L49 15 L55 18 L45 37 L51 39 L43 58 L47 60 L38 88" /><path className="profile-lightning-branch" d="M47 34 L35 40 L29 52 M44 57 L56 65 L60 73" /><ellipse className="profile-lightning-impact" cx="38" cy="88" rx="13" ry="2" /></svg></div>}
    {custom && config.id !== 'storm_field' && <div className="profile-backdrop-particles">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ left: `${(i * 37 + 4) % 100}%`, animationDelay: `${-i * .8}s`, animationDuration: `${8 + i % 5}s`, '--drift': `${(i % 2 ? 1 : -1) * (12 + i % 4 * 7)}px` } as CSSProperties} />)}</div>}
    <div className="profile-backdrop-shade" />
  </div>
}
