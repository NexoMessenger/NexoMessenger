import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n'
import { NexoMark } from './icons'

const KEY = 'nexo-ai-launcher-position'
const SIZE = 54
const MARGIN = 8
const clamp = (p: { x: number; y: number }) => ({
  x: Math.max(MARGIN, Math.min(p.x, window.innerWidth - SIZE - MARGIN)),
  y: Math.max(MARGIN, Math.min(p.y, window.innerHeight - SIZE - MARGIN)),
})

export default function AiLauncher() {
  const { t } = useI18n()
  const [position, setPosition] = useState<{x: number; y: number} | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return clamp(stored)
    } catch { /* Storage can be unavailable. */ }
    return null
  })
  const gesture = useRef<{id: number; x: number; y: number; left: number; top: number; dragged: boolean} | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => {
    const resize = () => setPosition(p => p ? clamp(p) : null)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const down = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, dragged: false }
    suppressClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent<HTMLAnchorElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x, dy = e.clientY - g.y
    if (Math.hypot(dx, dy) > 6) g.dragged = true
    if (g.dragged) setPosition(clamp({ x: g.left + dx, y: g.top + dy }))
  }
  const finish = (e: PointerEvent<HTMLAnchorElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    if (g.dragged) {
      suppressClick.current = true
      const p = clamp({ x: g.left + e.clientX - g.x, y: g.top + e.clientY - g.y })
      setPosition(p)
      try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* Use in-memory position. */ }
    }
    gesture.current = null
  }
  return <NavLink className="ai-bubble-launcher" to="/ai" aria-label={t('astra.open')} title={t('astra.open')}
    style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
    onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null }}
    onClick={e => { if (suppressClick.current) { e.preventDefault(); suppressClick.current = false } }}>
    <NexoMark size={24} /><span>AI</span>
  </NavLink>
}
