import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Scene, Character, Animation } from '@viggle/splat-engine'

export default function AstraSplat({ greeting, activity, onFailure, fallback }: { greeting: boolean; activity: number; onFailure: () => void; fallback: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [sitting, setSitting] = useState(false)
  const activityRef = useRef(activity); activityRef.current = activity
  const failureRef = useRef(onFailure); failureRef.current = onFailure
  useEffect(() => {
    let disposed = false, scene: Scene | undefined, timer = 0, frame = 0
    let contextLost: ((event: Event) => void) | undefined
    const element = canvas.current
    if (!element) return
    const init = async () => {
      try {
        const current = await Scene.create(element, { fov: 35, backend: 'webgl', bgColor: {r: 0, g: 0, b: 0, a: 0} })
        if (disposed) { current.destroy(); return }
        scene = current
        contextLost = event => { event.preventDefault(); if (!disposed) failureRef.current() }
        element.addEventListener('webglcontextlost', contextLost)
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const waveView = greeting && !reduced
        current.cameraEntity.setPosition(waveView ? 0 : 3.5, 1, waveView ? 3.5 : 0); current.cameraEntity.lookAt(0, 1, 0)
        current.start()
        const character = await Character.load(current, `${import.meta.env.BASE_URL}assets/astra.vsplat`)
        if (disposed) return
        await Promise.all([
          Animation.loadGlb(current, `${import.meta.env.BASE_URL}assets/astra-wave.glb`, 'wave'),
          Animation.loadGlb(current, `${import.meta.env.BASE_URL}assets/astra-sit.glb`, 'sit'),
        ])
        if (disposed) return
        if (greeting && !reduced) character.playAnimation('wave', { loop: false })
        setReady(true)
        if (greeting && !reduced) {
          let last = activityRef.current
          let deadline = Date.now() + 40000
          const check = () => {
            if (disposed) return
            if (last !== activityRef.current) { last = activityRef.current; deadline = Date.now() + 40000 }
            if (Date.now() >= deadline) {
              setSitting(true)
              character.crossfadeTo('sit', { duration: 0.6, loop: false })
              // The two source motions face different directions; orbit smoothly to the sitting front.
              const start = performance.now()
              const orbit = (now: number) => {
                if (disposed) return
                const x = Math.min(1, (now - start) / 1500), smooth = x*x*(3-2*x)
                const angle = smooth * Math.PI / 2
                current.cameraEntity.setPosition(-3.5 * Math.sin(angle), 1, 3.5 * Math.cos(angle))
                current.cameraEntity.lookAt(0, 1, 0)
                if (x < 1) frame = requestAnimationFrame(orbit)
              }
              frame = requestAnimationFrame(orbit)
              return
            }
            timer = window.setTimeout(check, 250)
          }
          timer = window.setTimeout(check, 250)
        }
      } catch (error) { console.error('Astra 3D failed:', error); if (!disposed) failureRef.current() }
    }
    const initTimer = window.setTimeout(() => { void init() }, 0)
    return () => { disposed = true; window.clearTimeout(initTimer); window.clearTimeout(timer); cancelAnimationFrame(frame); if (contextLost) element.removeEventListener('webglcontextlost', contextLost); scene?.destroy() }
  }, [greeting])
  return <div className={`astra-figure astra-3d${sitting ? ' astra-sitting' : ''}`} role="img" aria-label="Astra"><canvas ref={canvas} />{!ready && fallback}</div>
}
