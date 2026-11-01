import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { STUDIO } from '../content'
import { signTexture } from './textures'
import { Clickable } from './Interactive'
import { SIGN } from './views'

// Halo-lit studio sign on the slat wall. Clicking it switches it off/on (with a flicker on power-up).
export function Sign() {
  const on = useStore((s) => s.neon)
  const toggle = useStore((s) => s.toggleNeon)
  const entered = useStore((s) => s.entered)
  // pink neon halo in the night theme, amber otherwise
  const night = useStore((s) => s.theme === 'night')
  const tex = useMemo(
    () => (night ? signTexture(STUDIO.name, STUDIO.tagline, '#ff3d9e', '#ffe6f4', '#ffd3ea') : signTexture(STUDIO.name, STUDIO.tagline)),
    [night],
  )
  const mat = useRef()
  const light = useRef()
  const level = useRef(0)
  const since = useRef(0)
  const wasOn = useRef(false)

  useFrame((state) => {
    const lit = on && entered
    if (lit && !wasOn.current) since.current = state.clock.elapsedTime
    wasOn.current = lit
    const age = state.clock.elapsedTime - since.current
    let target = lit ? 1 : 0.06
    if (lit && age < 1.2) target = Math.random() > 0.4 + age * 0.4 ? 0.15 : 1
    level.current = THREE.MathUtils.lerp(level.current, target, lit && age < 1.2 ? 0.9 : 0.12)
    const l = level.current
    mat.current.color.setRGB(0.35 + l * 2.6, 0.35 + l * 2.6, 0.35 + l * 2.6)
    light.current.intensity = l * 7
  })

  return (
    <Clickable onSelect={toggle} position={SIGN.position}>
      <mesh userData={{ noShadow: true }}>
        <planeGeometry args={SIGN.size} />
        <meshBasicMaterial ref={mat} map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, -0.1, 0.5]} color={night ? '#ff4fa8' : '#ffa04a'} distance={4.5} decay={1.6} />
    </Clickable>
  )
}
