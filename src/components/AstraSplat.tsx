import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Scene, Character, Animation } from '@viggle/splat-engine'

export default function AstraSplat({ greeting, activity, onFailure, fallback }: { greeting: boolean; activity: number; onFailure: () => void; fallback: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [sitting, setSitting] = useState(false)
  const activityRef = useRef(activity); activityRef.current = activity
  const failureRef = useRef(onFailure); failureRef.current = onFailure
  useEffect(() => {
    let disposed = false, scene: Scene | undefined, timer = 0
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
          Animation.loadGlb(current, `${import.meta.env.BASE_URL}assets/astra-sit-alternative.glb`, 'sit'),
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
              // The replacement is a seated idle; blend into it, then keep it playing.
              character.crossfadeTo('sit', { duration: 1.5, loop: true })
              return
            }
            timer = window.setTimeout(check, 250)
          }
          timer = window.setTimeout(check, 250)
        }
      } catch (error) { console.error('Astra 3D failed:', error); if (!disposed) failureRef.current() }
    }
    const initTimer = window.setTimeout(() => { void init() }, 0)
    return () => { disposed = true; window.clearTimeout(initTimer); window.clearTimeout(timer); if (contextLost) element.removeEventListener('webglcontextlost', contextLost); scene?.destroy() }
  }, [greeting])
  return <div className={`astra-figure astra-3d${sitting ? ' astra-sitting' : ''}`} role="img" aria-label="Astra"><canvas ref={canvas} />{!ready && fallback}</div>
}
