import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/** Load only while Astra is visible. The fallback remains available on low-end devices. */
export default function AstraModel({ greeting, speaking, onFailure, fallback }: { greeting: boolean; speaking: boolean; onFailure: () => void; fallback: ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const speakingRef = useRef(speaking)
  const onFailureRef = useRef(onFailure)
  const [ready, setReady] = useState(false)
  speakingRef.current = speaking
  onFailureRef.current = onFailure

  useEffect(() => {
    const element = host.current
    if (!element) return
    let disposed = false
    let renderer: THREE.WebGLRenderer | undefined
    let model: THREE.Object3D | undefined
    let mixer: THREE.AnimationMixer | undefined
    let frame = 0
    let resize: ResizeObserver | undefined
    const clock = new THREE.Clock()
    let animating = false
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let scene: THREE.Scene | undefined
    let camera: THREE.PerspectiveCamera | undefined
    const fail = () => { if (!disposed) onFailureRef.current() }
    const render = () => { if (renderer && scene && camera) renderer.render(scene, camera) }
    const contextLost = (event: Event) => { event.preventDefault(); fail() }
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      element.appendChild(renderer.domElement)
      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
      scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 2))
      const light = new THREE.DirectionalLight(0xffffff, 2)
      light.position.set(2, 4, 5); scene.add(light)
      const refreshSize = () => {
        if (!renderer || !camera || !model || !element.clientWidth || !element.clientHeight) return
        const width = element.clientWidth, height = element.clientHeight
        renderer.setSize(width, height, false); camera.aspect = width / height
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
        const distance = Math.max(size.y, size.x / camera.aspect) * 1.7
        camera.position.set(center.x, center.y, center.z - distance); camera.lookAt(center); camera.updateProjectionMatrix()
        render()
      }
      resize = new ResizeObserver(refreshSize); resize.observe(element)
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      loader.load(`${import.meta.env.BASE_URL}assets/astra-3d.glb`, gltf => {
        if (disposed || !scene) { disposeModel(gltf.scene); return }
        model = gltf.scene; scene.add(model)
        mixer = new THREE.AnimationMixer(model)
        if (gltf.animations[0]) {
          const action = mixer.clipAction(gltf.animations[0])
          action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play()
          // At time zero the original hand and pose are visible.
          mixer.update(0)
          animating = greeting && !reducedMotion
          if (!animating) action.paused = true
        }
        setReady(true); refreshSize(); clock.start()
        const tick = () => {
          if (disposed || !animating || !mixer) return
          const dt = Math.min(clock.getDelta(), 0.05)
          const action = mixer.existingAction(gltf.animations[0])
          // Hold the end of the wave while the greeting voice is still playing.
          if (action && action.time >= 3.5 && speakingRef.current) {
            clock.getDelta()
          } else {
            mixer.update(dt); render()
          }
          if (action?.paused && !speakingRef.current) { animating = false; return }
          frame = requestAnimationFrame(tick)
        }
        if (animating) frame = requestAnimationFrame(tick)
      }, undefined, fail)
    } catch { fail() }
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize?.disconnect()
      mixer?.stopAllAction(); if (model) disposeModel(model)
      if (renderer) { renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); renderer.domElement.remove() }
    }
  }, [greeting])

  return <div className="astra-figure astra-3d" role="img" aria-label="Astra" ref={host}>{!ready && fallback}</div>
}

function disposeModel(root: THREE.Object3D) {
  root.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(material => {
      if (!material) return
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) value.dispose() })
      material.dispose()
    })
  })
}
