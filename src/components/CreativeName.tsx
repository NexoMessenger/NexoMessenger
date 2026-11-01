import type { CSSProperties } from 'react'
import { CREATIVE_BADGES, type CreativeBadge } from '../lib/nameBadges'

// Original, lightweight SVG ornaments. They are decorative, not emoji or user content.
const artwork: Record<CreativeBadge, string> = {
  starlight: 'M16 2 19 12 29 16 19 19 16 30 12 19 2 16 12 12Z',
  aurora: 'M3 23 Q8 5 15 15 T29 8 M3 28 Q9 12 16 21 T29 15',
  fire: 'M17 2 Q19 10 25 15 Q29 21 24 27 Q20 31 15 29 Q6 28 7 20 Q7 15 13 10 Q13 16 16 17 Q19 12 17 2Z',
  frost: 'M16 2 V30 M4 9 L28 23 M4 23 L28 9 M12 6 L16 10 L20 6 M12 26 L16 22 L20 26 M5 13 L10 12 L9 7 M27 19 L22 20 L23 25',
  lightning: 'M19 2 7 18 H15 L12 30 26 12 H18Z',
  ocean: 'M2 17 Q6 10 10 17 T18 17 T26 17 Q28 14 30 15 M2 24 Q6 17 10 24 T18 24 T26 24 Q28 21 30 22',
  royal: 'M3 9 9 14 16 4 23 14 29 9 26 25 H6Z M6 28 H26',
  moon: 'M22 3 A13 13 0 1 0 28 23 Q13 26 13 12 Q13 6 22 3Z',
  rainbow: 'M3 25 A13 13 0 0 1 29 25 M7 25 A9 9 0 0 1 25 25 M11 25 A5 5 0 0 1 21 25',
  rose: 'M16 13 Q10 8 8 14 Q5 19 11 22 Q16 25 21 22 Q27 19 24 14 Q22 8 16 13 M16 13 Q20 17 16 19 Q12 18 13 15 M16 23 V30 M16 27 Q10 27 9 24 M16 28 Q22 27 23 24',
  butterfly: 'M15 15 Q7 1 4 7 Q0 13 10 18 Q4 20 6 25 Q9 30 15 20 M17 15 Q25 1 28 7 Q32 13 22 18 Q28 20 26 25 Q23 30 17 20 M16 12 V23 M16 12 L12 7 M16 12 L20 7',
  comet: 'M20 12 L29 3 M18 9 L24 3 M23 14 L30 8 M16 12 A8 8 0 1 0 16 28 A8 8 0 1 0 16 12Z',
  bubbles: 'M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 M23 17 A5 5 0 1 0 23 27 A5 5 0 1 0 23 17 M9 9 L11 7',
  music: 'M14 7 V24 Q14 29 9 29 Q5 29 5 26 Q5 22 14 22 M14 7 L26 4 V20 Q26 25 21 25 Q17 25 17 22 Q17 18 26 18 V4Z',
  pixel: 'M4 4 H12 V12 H4Z M20 4 H28 V12 H20Z M12 12 H20 V20 H12Z M4 20 H12 V28 H4Z M20 20 H28 V28 H20Z',
}
const outlined = new Set<CreativeBadge>(['aurora', 'frost', 'ocean', 'rainbow', 'rose', 'butterfly', 'bubbles', 'music'])
const particles = [
  { x: '3%', y: '-6%', delay: '-.3s', size: '.68em', dx: '-.5em' },
  { x: '23%', y: '-20%', delay: '-1.4s', size: '.48em', dx: '.45em' },
  { x: '43%', y: '-8%', delay: '-2.8s', size: '.62em', dx: '-.3em' },
  { x: '64%', y: '-23%', delay: '-3.9s', size: '.52em', dx: '.55em' },
  { x: '84%', y: '-10%', delay: '-5.1s', size: '.65em', dx: '-.4em' },
  { x: '98%', y: '8%', delay: '-2.2s', size: '.44em', dx: '.3em' },
]

export function CreativeName({ name, kind }: { name: string; kind: CreativeBadge }) {
  const badge = CREATIVE_BADGES.find(item => item.id === kind)!
  return <span className={`creative-name creative-${kind}`} style={{ '--creative-color': badge.color, '--creative-glow': badge.glow } as CSSProperties}>
    <span className="creative-name-text">{name}</span>
    <span className="creative-particles" aria-hidden="true">{particles.map((p, i) => <span key={i} className={`creative-particle creative-motion-${badge.motion}`} style={{ left: p.x, top: p.y, fontSize: p.size, animationDelay: p.delay, '--particle-dx': p.dx } as CSSProperties}>
      <svg viewBox="0 0 32 32" width="1em" height="1em" focusable="false">{kind === 'rainbow' ? <g fill="none" strokeWidth="2.5" strokeLinecap="round"><path d="M3 25 A13 13 0 0 1 29 25" stroke="#ff829b"/><path d="M7 25 A9 9 0 0 1 25 25" stroke="#ffe28b"/><path d="M11 25 A5 5 0 0 1 21 25" stroke="#8fffea"/></g> : <path d={artwork[kind]} fill={outlined.has(kind) ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={outlined.has(kind) ? 2.5 : 1} strokeLinecap="round" strokeLinejoin="round" />}</svg>
    </span>)}</span>
  </span>
}
