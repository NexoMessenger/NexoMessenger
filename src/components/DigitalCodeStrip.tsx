import { useEffect, useRef, useState } from 'react'

const GLYPHS = '{ } < > / \\ ( ) [ ] # $ % & * + = ; : 0 1 λ ∑ ∆ ≈ § ¶ † ‡ • ◦ ▪ ▫ ▲ △ ◆ ◇ ○ ● □ ■'.split(' ')
const FRAGMENTS = ['const nexo = await sync()', 'msg.send({ secure: true })', 'glass.blur(24)', 'violet.glow(0.6)', 'realtime.on("message")', 'auth.session.restore()', 'e2e.encrypt(payload)', 'presence.heartbeat()', 'channel.broadcast()', 'if (online) render()', 'ui.theme = "nexoglass"', 'socket.connect(wss)']

function randomRow(len: number): string {
  const parts: string[] = []
  for (let i = 0; i < len; i++) {
    parts.push(Math.random() < 0.24 ? FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])
  }
  return parts.join('  ')
}

/**
 * Decorative animated digital-code strip for the welcome screen.
 * Pure CSS marquee (cheap on low-end Android), content regenerated locally
 * every few seconds with a soft fade. Pauses when the tab is hidden and
 * renders a static pattern under prefers-reduced-motion. Contains no real
 * code execution, secrets or credentials — fragments are fictional.
 */
export default function DigitalCodeStrip() {
  const [rowA, setRowA] = useState(() => randomRow(46))
  const [rowB, setRowB] = useState(() => randomRow(46))
  const [fade, setFade] = useState(false)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced.current) return
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    const iv = setInterval(() => {
      if (document.hidden) return
      setFade(true)
      setTimeout(() => { setRowA(randomRow(46)); setRowB(randomRow(46)); setFade(false) }, 650)
    }, 5200)
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv) }
  }, [])

  const style = paused ? { animationPlayState: 'paused' as const } : undefined
  return (
    <div className="code-strip" aria-hidden="true">
      <div className={`code-strip-inner ${fade ? 'code-fade' : ''}`}>
        <div className="code-row code-row-a" style={style}><span>{rowA}&nbsp;&nbsp;◆&nbsp;&nbsp;{rowA}</span></div>
        <div className="code-row code-row-b" style={style}><span>{rowB}&nbsp;&nbsp;◇&nbsp;&nbsp;{rowB}</span></div>
      </div>
    </div>
  )
}
