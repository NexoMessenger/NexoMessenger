import { useEffect, useMemo, useRef, useState } from 'react'
import type { Reaction } from '../lib/types'
import { IconPlay, IconPause } from './icons'

export const REACTION_SET = ['❤️', '😂', '🔥', '😮', '😢', '👍', '👎', '🎉']

const ANIMATED_EMOJI_ANIM: Record<string, string> = {
  '🔥': 'pulse', '💎': 'float', '⭐': 'spin', '🚀': 'float', '🎉': 'bounce',
  '❤️': 'pulse', '😂': 'shake', '😮': 'bounce', '👑': 'float', '⚡': 'pulse',
  '🌙': 'float', '🦊': 'bounce',
}

/**
 * Message body renderer: a message made only of NEXO animated emoji (1–3)
 * renders big with a CSS animation; anything else is plain text.
 */
export function AnimatedEmojiBody({ body }: { body: string }) {
  const trimmed = body.trim()
  const found: string[] = []
  let rest = trimmed.replace(/\s+/g, '')
  let guard = 0
  while (rest && guard++ < 4) {
    const hit = Object.keys(ANIMATED_EMOJI_ANIM).find((e) => rest.startsWith(e))
    if (!hit) break
    found.push(hit)
    rest = rest.slice(hit.length)
  }
  if (found.length >= 1 && found.length <= 3 && rest === '') {
    return (
      <span className="nexo-emoji-message">
        {found.map((e, i) => (
          <span key={i} className={`nexo-emoji-anim anim-${ANIMATED_EMOJI_ANIM[e]}`} style={{ animationDelay: `${i * 120}ms` }}>{e}</span>
        ))}
      </span>
    )
  }
  return <>{body}</>
}

export function fmtDuration(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Optimistic local toggle mirroring api.toggleReaction semantics. */
export function toggleReactionLocal(
  list: Reaction[], scope: Reaction['scope'], conversationId: string,
  messageId: string, userId: string, emoji: string,
): Reaction[] {
  const existing = list.find((r) => r.message_id === messageId && r.user_id === userId)
  if (existing && existing.emoji === emoji) return list.filter((r) => r.id !== existing.id)
  if (existing) return list.map((r) => (r.id === existing.id ? { ...r, emoji } : r))
  return [...list, {
    id: `local-${Date.now()}`, scope, conversation_id: conversationId,
    message_id: messageId, user_id: userId, emoji, created_at: new Date().toISOString(),
  }]
}

/* ------------------------- reaction burst effects ------------------------- */

export interface BurstSpec { id: number; x: number; y: number; emoji: string }

const BURST_GLYPHS: Record<string, string[]> = {
  '❤️': ['❤️', '💗', '💖', '💜', '❤️', '💓', '❤️', '💗'],
  '🔥': ['🔥', '✨', '🔥', '✨', '🧡', '🔥', '✨', '🔥'],
  '😂': ['😂', '🤣', '😂', '🤣', '😂', '🤣', '😂', '🤣'],
  '🎉': ['🎉', '✨', '🎊', '⭐', '✨', '🎉', '✨', '🎊'],
}

export const reducedMotion = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * Short celebratory particle burst shown where a reaction is added.
 * Pure transform/opacity animation, pointer-transparent, auto-removed by
 * the parent after ~750ms, and fully disabled for reduced-motion users.
 */
export function ReactionBursts({ bursts }: { bursts: BurstSpec[] }) {
  if (!bursts.length || reducedMotion()) return null
  return (
    <>
      {bursts.map((b) => {
        const glyphs = BURST_GLYPHS[b.emoji] || Array(8).fill(b.emoji)
        return (
          <div key={b.id} className="reaction-burst" style={{ left: b.x, top: b.y }} aria-hidden="true">
            {glyphs.map((g, i) => {
              const dx = (i % 2 === 0 ? -1 : 1) * (12 + ((i * 29) % 40))
              const dy = -(20 + ((i * 37) % 52))
              const rot = ((i * 53) % 70) - 35
              const size = 10 + ((i * 7) % 8)
              return (
                <span key={i} style={{
                  ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`,
                  ['--rot' as string]: `${rot}deg`, fontSize: size, animationDelay: `${(i % 4) * 24}ms`,
                }}>{g}</span>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

export function ReactionBar({ reactions, meId, onToggle }: {
  reactions: Reaction[]
  meId: string
  onToggle: (emoji: string, ev: { clientX: number; clientY: number }) => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>()
    reactions.forEach((r) => {
      const g = map.get(r.emoji) || { count: 0, mine: false }
      g.count += 1
      if (r.user_id === meId) g.mine = true
      map.set(r.emoji, g)
    })
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [reactions, meId])
  if (!grouped.length) return null
  return (
    <div className="reaction-bar">
      {grouped.map(([emoji, g]) => (
        <button key={emoji} className={`reaction-chip ${g.mine ? 'mine' : ''}`} onClick={(ev) => onToggle(emoji, ev)}
          aria-pressed={g.mine} aria-label={`${emoji} ${g.count}`}>
          <span>{emoji}</span><span className="reaction-count">{g.count}</span>
        </button>
      ))}
    </div>
  )
}

function barsFor(seed: string, n = 26) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0
    return 6 + (h % 16)
  })
}

/** NEXO voice-message player: play/pause, progress, waveform-style bars. */
export function AudioBubble({ url, duration = 0, label }: { url: string; duration?: number; label: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(duration)
  const bars = useMemo(() => barsFor(url), [url])

  useEffect(() => () => { ref.current?.pause() }, [])

  const toggle = () => {
    const a = ref.current
    if (!a) return
    if (playing) a.pause()
    else a.play().catch(() => setPlaying(false))
  }

  return (
    <div className="audio-bubble">
      <audio ref={ref} src={url} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onLoadedMetadata={() => { const d = ref.current?.duration; if (d && isFinite(d)) setTotal(d) }}
        onTimeUpdate={() => { const a = ref.current; if (a && a.duration) setProgress(a.currentTime / a.duration) }} />
      <button className="audio-play" onClick={toggle} aria-label={label}>
        {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
      </button>
      <div className="audio-wave" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}
        onClick={(e) => {
          const a = ref.current; if (!a || !a.duration) return
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration
        }}>
        {bars.map((hgt, i) => (
          <span key={i} className={`audio-bar ${i / bars.length <= progress ? 'played' : ''}`} style={{ height: hgt }} />
        ))}
      </div>
      <span className="audio-time">{fmtDuration(total)}</span>
    </div>
  )
}

/** Telegram-style round video message: tap to play/pause, ring progress. */
export function VideoCircle({ url, duration = 0, label }: { url: string; duration?: number; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(duration)
  const R = 76
  const C = 2 * Math.PI * R

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (playing) v.pause()
    else v.play().catch(() => setPlaying(false))
  }

  return (
    <div className="video-circle-wrap">
      <button className="video-circle" onClick={toggle} aria-label={label}>
        <video ref={ref} src={url} playsInline preload="metadata" muted={false}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0) }}
          onLoadedMetadata={() => { const d = ref.current?.duration; if (d && isFinite(d)) setTotal(d) }}
          onTimeUpdate={() => { const v = ref.current; if (v && v.duration) setProgress(v.currentTime / v.duration) }} />
        <svg className="video-ring" viewBox="0 0 168 168" aria-hidden="true">
          <circle cx="84" cy="84" r={R} className="video-ring-bg" />
          <circle cx="84" cy="84" r={R} className="video-ring-fg"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        {!playing && <span className="video-play-badge"><IconPlay size={20} /></span>}
        <span className="video-duration">{fmtDuration(total)}</span>
      </button>
    </div>
  )
}
