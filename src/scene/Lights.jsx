import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { flicker } from './flicker'
import { DESK, SIGN, WINDOW } from './views'

// The room's light is baked into its textures, so these lights only touch the two characters.
// They stand in for the baked practicals: the desk pendants, the sign behind them, the sunset
// window on the right and the soft bounce from the open front. Every light has a warm look and a
// night look; on a theme change colours and intensities ease across in about a second.

const L = (color, intensity) => ({ color, intensity })
const [dx, , dz] = DESK

const lights = [
  { type: 'hemi', warm: L('#ffcf9a', 0.55), night: L('#9a7a78', 0.45), ground: ['#3a2414', '#140a0a'] },
  // pendant pools over the desk
  { type: 'spot', position: [dx - 0.4, 1.95, dz], target: [dx - 0.4, 0.7, dz], angle: 1.15, shadow: 1024, warm: L('#ffc58f', 9), night: L('#ffc08a', 5) },
  // sign glow from behind: warm rim on hair and shoulders
  { type: 'point', position: [SIGN.position[0], SIGN.position[1], SIGN.position[2] + 0.6], distance: 7, warm: L('#ffa55c', 6), night: L('#ff4f9f', 5) },
  // low sunset through the window, faint moonlight at night
  { type: 'dir', position: [WINDOW.x + 1.5, 2.4, WINDOW.z], warm: L('#ff9d5c', 0.9), night: L('#6a80ff', 0.35) },
  // the candles on the desk between them: a flickering amber glow, strongest at night
  { type: 'point', position: [dx + 0.05, 0.95, dz - 0.15], distance: 2.5, flicker: true, warm: L('#ffb070', 0.4), night: L('#ff7a30', 1.6) },
  // soft bounce from the open front so faces are never black
  { type: 'point', position: [dx + 0.3, 2.2, dz + 3.4], distance: 9, warm: L('#ffd2a8', 3.5), night: L('#c99a90', 3) },
]

const BACKGROUND = { warm: new THREE.Color('#0b0908'), night: new THREE.Color('#0a0708') }
const ENVIRONMENT = { warm: 0.55, night: 0.35 }

// Spot light whose target is placed once (the target object is not part of the scene graph).
function Spot({ target, onLight, ...props }) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current.target.position.set(...target)
    ref.current.target.updateMatrixWorld()
    onLight(ref.current)
  }, [])
  return <spotLight ref={ref} decay={2} penumbra={0.9} {...props} />
}

const shadowProps = (size) => ({
  castShadow: true,
  'shadow-mapSize': [size, size],
  'shadow-bias': -0.0003,
  'shadow-normalBias': 0.02,
})

export function Lights() {
  const grounds = useMemo(() => lights.map((l) => l.ground && { warm: new THREE.Color(l.ground[0]), night: new THREE.Color(l.ground[1]) }), [])
  const refs = useRef([])
  const theme = useStore((s) => s.theme)
  const scene = useThree((s) => s.scene)
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }, dt) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 3.5)
    lights.forEach((l, i) => {
      const light = refs.current[i]
      if (!light) return
      const to = l[theme]
      light.color.lerp(tmp.set(to.color), k)
      const level = (light.userData.level ??= light.intensity)
      light.userData.level = level + (to.intensity - level) * k
      light.intensity = light.userData.level * (l.flicker && !reduced ? 1 + 0.15 * flicker(clock.elapsedTime, i) : 1)
      if (grounds[i]) light.groundColor.lerp(grounds[i][theme], k)
    })
    if (scene.background?.isColor) scene.background.lerp(BACKGROUND[theme], k)
    scene.environmentIntensity += (ENVIRONMENT[theme] - scene.environmentIntensity) * k
  })

  return lights.map((l, i) => {
    const keep = (el) => (refs.current[i] = el)
    const base = { color: l.warm.color, intensity: l.warm.intensity }
    if (l.type === 'hemi') return <hemisphereLight key={i} ref={keep} {...base} groundColor={l.ground[0]} />
    if (l.type === 'dir') return <directionalLight key={i} ref={keep} {...base} position={l.position} />
    if (l.type === 'point') return <pointLight key={i} ref={keep} {...base} position={l.position} distance={l.distance} decay={1.6} />
    return <Spot key={i} onLight={keep} {...base} position={l.position} target={l.target} angle={l.angle} {...(l.shadow ? shadowProps(l.shadow) : {})} />
  })
}
