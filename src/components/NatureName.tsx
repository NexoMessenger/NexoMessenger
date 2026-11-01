import type { CSSProperties } from 'react'

const ornaments = [
  { x: '4%', y: '-12%', delay: '-.4s', size: '.65em', dx: '-.3em' },
  { x: '20%', y: '-22%', delay: '-2.1s', size: '.52em', dx: '.7em' },
  { x: '37%', y: '-16%', delay: '-3.5s', size: '.7em', dx: '-.55em' },
  { x: '57%', y: '-26%', delay: '-5.1s', size: '.54em', dx: '.4em' },
  { x: '76%', y: '-15%', delay: '-6.4s', size: '.64em', dx: '-.4em' },
  { x: '96%', y: '-20%', delay: '-1.2s', size: '.55em', dx: '.5em' },
]

function Clover() {
  return <svg viewBox="0 0 32 32" width="1em" height="1em" focusable="false"><path d="M16 21c1 4 3 6 5 8" fill="none" stroke="#126933" strokeWidth="2.1" strokeLinecap="round"/><path d="M16 21C11 18 6 17 6 12.4c0-3.6 4.3-4.8 7-1.8C11 6 13.2 3 16 3s5 3 3 7.6c2.7-3 7-1.8 7 1.8 0 4.6-5 5.6-10 8.6Z" fill="#22ad49" stroke="#8af49c" strokeWidth="1.2" strokeLinejoin="round"/><path d="M16 12v8m-5-6 5 6 5-6" stroke="#187d3b" strokeWidth="1" fill="none"/></svg>
}
function Blossom() {
  return <svg viewBox="0 0 32 32" width="1em" height="1em" focusable="false"><g fill="#ffafd7" stroke="#ff65aa" strokeWidth=".8"><ellipse cx="16" cy="8" rx="4" ry="7"/><ellipse cx="23.6" cy="13.5" rx="4" ry="7" transform="rotate(72 23.6 13.5)"/><ellipse cx="20.7" cy="22.3" rx="4" ry="7" transform="rotate(144 20.7 22.3)"/><ellipse cx="11.3" cy="22.3" rx="4" ry="7" transform="rotate(216 11.3 22.3)"/><ellipse cx="8.4" cy="13.5" rx="4" ry="7" transform="rotate(288 8.4 13.5)"/></g><circle cx="16" cy="16" r="2.2" fill="#ffd96f"/></svg>
}

/** Decoration never intercepts pointer events or replaces the readable name. */
export function NatureName({ name, kind }: { name: string; kind: 'clover' | 'sakura' }) {
  return <span className={`nature-name nature-name-${kind}`}><span className="nature-name-text">{name}</span><span className="nature-name-particles" aria-hidden="true">{ornaments.map((item, index) => <span className="nature-name-particle" key={index} style={{ left: item.x, top: item.y, fontSize: item.size, animationDelay: item.delay, '--nature-dx': item.dx } as CSSProperties}>{kind === 'clover' ? <Clover /> : <Blossom />}</span>)}</span></span>
}
