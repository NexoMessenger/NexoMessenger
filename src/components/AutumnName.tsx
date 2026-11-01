/** Decorative leaves are visual only; the real name remains selectable text. */
const leaves = [
  { x: '6%', y: '35%', dx: '-1.5em', dy: '-0.9em', delay: '-0.2s', size: '.72em', color: '#ff9d13' },
  { x: '24%', y: '65%', dx: '-1em', dy: '1.1em', delay: '-1.5s', size: '.56em', color: '#f45a16' },
  { x: '43%', y: '20%', dx: '-.35em', dy: '-1.25em', delay: '-2.8s', size: '.66em', color: '#ffb322' },
  { x: '58%', y: '70%', dx: '.65em', dy: '1.05em', delay: '-4s', size: '.6em', color: '#e44a14' },
  { x: '75%', y: '25%', dx: '1em', dy: '-1.1em', delay: '-5.1s', size: '.7em', color: '#ff7b16' },
  { x: '92%', y: '55%', dx: '1.5em', dy: '.75em', delay: '-6.4s', size: '.6em', color: '#ffb21a' },
]
export function AutumnName({ name }: { name: string }) {
  return <span className="autumn-name"><span className="autumn-name-text">{name}</span><span className="autumn-leaves" aria-hidden="true">{leaves.map((leaf, index) => <span key={index} className="autumn-leaf" style={{ left: leaf.x, top: leaf.y, color: leaf.color, fontSize: leaf.size, animationDelay: leaf.delay, '--leaf-x': leaf.dx, '--leaf-y': leaf.dy } as React.CSSProperties}><svg viewBox="0 0 32 32" width="1em" height="1em" focusable="false"><path fill="currentColor" stroke="#7e2e0e" strokeWidth="1.2" strokeLinejoin="round" d="M16 2l2.7 6 4-3-.3 6.2 5.8-1.1-3.8 5 5 2.6-6 1.3 1.3 5-5.2-2-1.9 7-1.3-6.8-5.5 2 1.3-5-6-1.3 5-2.6-3.8-5 5.8 1.1L9.7 5l4 3z"/><path d="M16 11v15M16 21l-5-4M16 20l5-4" fill="none" stroke="#8d360f" strokeWidth=".8" strokeLinecap="round"/></svg></span>)}</span></span>
}
