import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { LAYOUT } from './views'

// Every room light has a warm look (amber evening) and a night look (dim blue, pink and black).
// When the theme changes, colours and intensities ease across in about a second.

const L = (color, intensity) => ({ color, intensity })

const lights = (mid) => [
  { type: 'ambient', warm: L('#ffd2a8', 0.22), night: L('#2a3470', 0.2) },
  { type: 'hemi', warm: L('#ffcf9a', 0.4), night: L('#3a4690', 0.32), ground: ['#2a1a0e', '#0b0718'] },
  // broad key and a front fill so every part of the room reads clearly
  { type: 'dir', position: [-3, 3.5, 4], warm: L('#ffc489', 1.1), night: L('#5868d0', 0.45) },
  { type: 'dir', position: [1, 2.5, 6], warm: L('#fff1e2', 0.45), night: L('#ff6fb5', 0.2) },
  // key over the shared desk
  { type: 'spot', position: [0.3, 4.1, 2.6], target: [0.2, 0.6, 0.9], angle: 0.62, shadow: 2048, warm: L('#ffc58f', 70), night: L('#b3b0ff', 28) },
  // grazing washes on the slat wall — pink at night
  { type: 'spot', position: [mid - 0.9, 4.1, -3.7], target: [mid - 0.9, 0.2, -5], angle: 0.85, shadow: 1024, warm: L('#ffb46e', 38), night: L('#ff4f9f', 30) },
  { type: 'spot', position: [mid + 0.9, 4.1, -3.7], target: [mid + 0.9, 0.2, -5], angle: 0.85, warm: L('#ffb46e', 38), night: L('#ff4f9f', 30) },
  // lounge, art and shelf
  { type: 'spot', position: [-3.9, 3.85, -2.0], target: [-4.0, 0.3, -4.2], angle: 0.8, shadow: 1024, warm: L('#ffc896', 40), night: L('#6c7cff', 22) },
  { type: 'spot', position: [LAYOUT.art, 4.0, -3.4], target: [LAYOUT.art, 2.2, -5], angle: 0.32, warm: L('#ffd9b0', 14), night: L('#d4c4ff', 8) },
  { type: 'spot', position: [LAYOUT.shelf, 4.0, -3.5], target: [LAYOUT.shelf, 1.0, -5], angle: 0.5, warm: L('#ffc48a', 16), night: L('#ff6fb8', 12) },
  // bookshelf wash
  { type: 'spot', position: [-4.2, 4.0, 1.8], target: [-6, 1.3, 1.8], angle: 0.95, warm: L('#ffbe80', 30), night: L('#6f80ff', 16) },
  // ID wall
  { type: 'spot', position: [LAYOUT.pegboard, 4.0, -3.3], target: [LAYOUT.pegboard, 2, -5], angle: 0.42, warm: L('#ffe2c4', 14), night: L('#c2b4ff', 9) },
  // glow through the curtain
  { type: 'point', position: [-5.0, 0.3, -4.6], distance: 3.4, decay: 1.6, warm: L('#ff7a2a', 4), night: L('#ff3d9a', 3.5) },
  { type: 'point', position: [-5.6, 0.3, -2.8], distance: 3, decay: 1.6, warm: L('#ff7a2a', 3), night: L('#ff3d9a', 3) },
  // light spilling in from the city window: low golden sunset, cool moonlight at night
  { type: 'spot', position: [7.2, 2.6, -2.0], target: [2.5, 0.2, -1.5], angle: 0.55, warm: L('#ff9d5c', 34), night: L('#5a72ff', 14) },
  // soft front fill so the open side of the room is not black
  { type: 'point', position: [0.5, 2.8, 5.0], distance: 12, decay: 1.4, warm: L('#ffb47a', 10), night: L('#3d4fb8', 7) },
]

const BACKGROUND = { warm: new THREE.Color('#0b0908'), night: new THREE.Color('#06050d') }
const ENVIRONMENT = { warm: 0.4, night: 0.14 }

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
  const specs = useMemo(() => lights((LAYOUT.slats[0] + LAYOUT.slats[1]) / 2), [])
  const grounds = useMemo(() => specs.map((l) => l.ground && { warm: new THREE.Color(l.ground[0]), night: new THREE.Color(l.ground[1]) }), [specs])
  const refs = useRef([])
  const theme = useStore((s) => s.theme)
  const scene = useThree((s) => s.scene)
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3.5)
    specs.forEach((l, i) => {
      const light = refs.current[i]
      if (!light) return
      const to = l[theme]
      light.color.lerp(tmp.set(to.color), k)
      light.intensity += (to.intensity - light.intensity) * k
      if (grounds[i]) light.groundColor.lerp(grounds[i][theme], k)
    })
    if (scene.background?.isColor) scene.background.lerp(BACKGROUND[theme], k)
    scene.environmentIntensity += (ENVIRONMENT[theme] - scene.environmentIntensity) * k
  })

  return specs.map((l, i) => {
    const keep = (el) => (refs.current[i] = el)
    const base = { color: l.warm.color, intensity: l.warm.intensity }
    if (l.type === 'ambient') return <ambientLight key={i} ref={keep} {...base} />
    if (l.type === 'hemi') return <hemisphereLight key={i} ref={keep} {...base} groundColor={l.ground[0]} />
    if (l.type === 'dir') return <directionalLight key={i} ref={keep} {...base} position={l.position} />
    if (l.type === 'point') return <pointLight key={i} ref={keep} {...base} position={l.position} distance={l.distance} decay={l.decay} />
    return <Spot key={i} onLight={keep} {...base} position={l.position} target={l.target} angle={l.angle} {...(l.shadow ? shadowProps(l.shadow) : {})} />
  })
}
