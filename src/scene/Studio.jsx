import { lazy, Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../store'
import { CameraRig } from './CameraRig'
import { Hotspots } from './Interactive'
import { Lights } from './Lights'
import { BakedRoom, RoomReflection } from './BakedRoom'
import { Team } from './Team'
import { Cat } from './Cat'
import { Sign } from './Feature'
import { CityWindow } from './CityWindow'
import { DESK } from './views'
const DevSceneTools = import.meta.env.DEV ? lazy(()=>import('./DevSceneTools')) : null

// Only lit (non-basic) meshes cast and receive shadows: in practice the two characters, since the
// room's shadows are baked. Shadow maps are drawn once after load instead of every frame.
function ShadowSetup() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      const skip = o.userData.noShadow || o.material?.transparent || o.material?.isMeshBasicMaterial
      o.castShadow = !skip
      o.receiveShadow = !skip
    })
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    // once more after everything has settled into place
    const t = setTimeout(() => {
      gl.shadowMap.needsUpdate = true
      invalidate()
    }, 800)
    return () => clearTimeout(t)
  }, [scene, gl, invalidate])
  return null
}

// Renders on demand: full frame rate while someone is interacting or the camera is moving,
// a calm ~24 fps for the idle animations otherwise, and nothing while the tab is hidden.
function FrameDriver() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const IDLE_FPS = 24
    const BUSY_FOR = 2500 // ms of full frame rate after any interaction
    let lastFrame = 0
    let lastActive = performance.now()
    let raf
    const wake = () => (lastActive = performance.now())
    const events = ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    const unsubscribe = useStore.subscribe(wake) // opening a section, theme switch, etc.
    const loop = (now) => {
      raf = requestAnimationFrame(loop) // browsers stop this entirely in hidden tabs
      if (now - lastActive < BUSY_FOR || (!reduced && now - lastFrame > 1000 / IDLE_FPS)) {
        lastFrame = now
        invalidate()
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      events.forEach((e) => window.removeEventListener(e, wake))
      unsubscribe()
    }
  }, [invalidate])
  return null
}

// Signals the loader once a few frames have rendered (shaders compiled, shadows drawn).
function Ready({ onReady }) {
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) onReady?.()
  })
  return null
}

export function Studio({ onReady }) {
  return (
    <>
      <color attach="background" args={['#0b0908']} />
      <CameraRig />
      <Lights />
      {/* the characters reflect the baked room, captured once from the middle of the desk */}
      <Environment resolution={256} environmentIntensity={0.55} frames={1}>
        <RoomReflection position={[-DESK[0], -1.1, -DESK[2]]} />
      </Environment>
      <BakedRoom />
      <Team />
      <Cat />
      <Sign />
      <CityWindow />
      {DevSceneTools && <Suspense fallback={null}><DevSceneTools /></Suspense>}
      <Hotspots />
      <ShadowSetup />
      <FrameDriver />
      <Ready onReady={onReady} />
      {/* lighting and AO are baked; AgX matches Blender's view transform */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={0.55} radius={0.6} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.4} darkness={0.35} />
      </EffectComposer>
    </>
  )
}
