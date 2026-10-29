import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, SoftShadows, Sparkles } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useStore } from '../store'
import { CameraRig } from './CameraRig'
import { Hotspots } from './Interactive'
import { Room } from './Room'
import { Lights } from './Lights'
import { Lounge } from './Lounge'
import { Workspace } from './Workspace'
import { Bookshelf } from './Bookshelf'
import { Credenza, Pegboard, Sign } from './Feature'
import { Plants } from './Plants'
import { CityWindow } from './CityWindow'

// Every opaque mesh casts and receives shadows unless it opts out (glows, screens, glass).
// The room never moves, so shadow maps are drawn once after load instead of every frame.
function ShadowSetup() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      const skip = o.userData.noShadow || o.material?.transparent || o.material?.isMeshBasicMaterial
      o.castShadow = !skip
      o.receiveShadow = !o.material?.isMeshBasicMaterial
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
      if (now - lastActive < BUSY_FOR || now - lastFrame > 1000 / IDLE_FPS) {
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
      {/* contact-hardening shadows give the soft, miniature clay-render look */}
      <SoftShadows size={24} samples={12} focus={0.6} />
      <CameraRig />
      <Lights />
      <Environment resolution={128} environmentIntensity={0.4} frames={1}>
        <Lightformer form="rect" intensity={2} color="#ffb070" position={[0, 3, -4]} scale={[6, 1, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff9a4a" position={[2, 2.5, -4]} scale={[2, 1, 1]} />
        <Lightformer form="rect" intensity={1} color="#ffe2c2" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
      </Environment>
      <Room />
      <Lounge />
      <Workspace />
      <Bookshelf />
      <Credenza />
      <Sign />
      <Pegboard />
      <Plants />
      <CityWindow />
      <Sparkles count={50} scale={[9, 3.2, 7]} position={[0, 2, -0.5]} size={1.4} speed={0.15} opacity={0.25} color="#ffcf9e" noise={0.6} />
      <Hotspots />
      <ShadowSetup />
      <FrameDriver />
      <Ready onReady={onReady} />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.5} intensity={1.6} distanceFalloff={0.6} color="#0f0704" />
        <Bloom mipmapBlur luminanceThreshold={1.2} luminanceSmoothing={0.2} intensity={0.6} radius={0.55} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.4} darkness={0.35} />
      </EffectComposer>
    </>
  )
}
