import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { STUDIO, TEAM } from '../content'
import { pegboard, photoCard, signTexture, woodGrain } from './textures'
import { Box, Cyl, Glow, Soft } from './parts'
import { Clickable } from './Interactive'
import { SmallPlant } from './Plants'
import { LAYOUT } from './views'

const SLAT_MID = (LAYOUT.slats[0] + LAYOUT.slats[1]) / 2

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
    <Clickable onSelect={toggle} position={[SLAT_MID, 2.78, -4.87]}>
      <mesh userData={{ noShadow: true }}>
        <planeGeometry args={[2.95, 1.3]} />
        <meshBasicMaterial ref={mat} map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, -0.1, 0.5]} color={night ? '#ff4fa8' : '#ffa04a'} distance={4.5} decay={1.6} />
    </Clickable>
  )
}

// Dome table lamp with a glowing shade.
export function TableLamp({ scale = 1, light = 2.2, ...props }) {
  return (
    <group scale={scale} {...props}>
      <Cyl args={[0.07, 0.08, 0.02, 24]} position={[0, 0.01, 0]} color="#1a1612" metalness={0.6} roughness={0.35} />
      <Cyl args={[0.012, 0.012, 0.26]} position={[0, 0.14, 0]} color="#b8925a" metalness={0.8} roughness={0.3} />
      <mesh position={[0, 0.27, 0]}>
        <sphereGeometry args={[0.13, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color={[3.2, 2.1, 1.15]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 0.22, 0.1]} intensity={light} distance={2.6} decay={2} color="#ffb067" />
    </group>
  )
}

function Candle(props) {
  return (
    <group {...props}>
      <Cyl args={[0.035, 0.035, 0.08, 16]} position={[0, 0.04, 0]} color="#f2e8d8" roughness={0.5} />
      <Glow geometry="sphere" args={[0.012, 8, 6]} position={[0, 0.1, 0]} scale={[1, 1.8, 1]} color={[8, 4, 1.4]} />
    </group>
  )
}

export function Credenza() {
  const wood = useMemo(() => woodGrain('cred', 20, 20), [])
  return (
    <group position={[SLAT_MID, 0, -4.68]}>
      <Soft args={[2.9, 0.52, 0.45]} radius={0.015} position={[0, 0.34, 0]} map={wood} color="#ffffff" roughness={0.45} />
      {[-0.725, 0, 0.725].map((x) => (
        <Box key={x} args={[0.004, 0.46, 0.004]} position={[x, 0.34, 0.227]} color="#0a0705" />
      ))}
      {[-1.35, 1.35].map((x) => (
        <Box key={x} args={[0.04, 0.08, 0.38]} position={[x, 0.04, 0]} color="#111" metalness={0.5} />
      ))}
      <SmallPlant position={[-1.15, 0.6, 0.02]} seed={21} scale={1.7} />
      <SmallPlant position={[1.2, 0.6, -0.05]} seed={7} scale={1.4} trailing />
      <Box args={[0.26, 0.04, 0.2]} position={[-0.55, 0.62, 0.02]} rotation-y={0.1} color="#c9b48f" />
      <Box args={[0.24, 0.035, 0.18]} position={[-0.55, 0.66, 0.02]} rotation-y={-0.1} color="#2f3a2c" />
      <Cyl args={[0.05, 0.08, 0.26, 20]} position={[0.75, 0.73, 0.02]} color="#e9e1d4" roughness={0.4} />
      <Candle position={[0.3, 0.6, 0.08]} />
      <Candle position={[0.42, 0.6, 0.02]} scale={[1, 1.4, 1]} />
    </group>
  )
}

// A founder's studio ID on a lanyard, swaying gently.
function Card({ person, i, x }) {
  const ref = useRef()
  const tex = useMemo(() => photoCard(person), [person])
  const len = 0.16 + i * 0.04
  const W = 0.27
  const H = 0.405
  useFrame((s) => {
    ref.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.9 + i * 1.3) * 0.025
  })
  return (
    <group position={[x, 0.36, 0.03]}>
      <Cyl args={[0.007, 0.007, 0.05]} rotation-x={Math.PI / 2} color="#bbb" metalness={0.9} roughness={0.2} />
      <group ref={ref}>
        <Box args={[0.026, len, 0.002]} position={[0, -len / 2, 0.02]} color={person.color} roughness={0.8} />
        <Box args={[0.034, 0.034, 0.006]} position={[0, -len, 0.02]} color="#cfcfcf" metalness={0.9} />
        <group position={[0, -len - H / 2 - 0.01, 0.024]}>
          <Box args={[W + 0.008, H + 0.008, 0.004]} color="#eeeeee" roughness={0.4} />
          <mesh position-z={0.0025}>
            <planeGeometry args={[W, H]} />
            <meshStandardMaterial map={tex} roughness={0.35} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// Backlit pegboard with the two founders' studio IDs.
export function Pegboard() {
  const tex = useMemo(() => pegboard(), [])
  const x = LAYOUT.pegboard
  return (
    <group>
      <Clickable id="about" position={[x, 2.2, -4.9]}>
        <mesh position={[0, 0, -0.02]} userData={{ noShadow: true }}>
          <planeGeometry args={[1.62, 1.25]} />
          <meshBasicMaterial color={[2.2, 1.9, 1.6]} toneMapped={false} />
        </mesh>
        <Box args={[1.55, 1.18, 0.03]}>
          <meshStandardMaterial map={tex} roughness={0.7} />
        </Box>
        {TEAM.map((p, i) => (
          <Card key={p.name} person={p} i={i} x={i === 0 ? -0.3 : 0.3} />
        ))}
      </Clickable>
      {/* low cabinet with lamp, globe and books */}
      <group position={[x, 0, -4.72]}>
        <Soft args={[1.7, 0.66, 0.46]} radius={0.015} position={[0, 0.38, 0]} color="#1b1a1a" roughness={0.55} />
        <Box args={[0.004, 0.58, 0.004]} position={[0, 0.38, 0.232]} color="#000" />
        {[-0.05, 0.05].map((dx) => (
          <Box key={dx} args={[0.015, 0.18, 0.012]} position={[dx, 0.42, 0.236]} color="#c9a46a" metalness={0.85} roughness={0.25} />
        ))}
        {[-0.75, 0.75].map((dx) => (
          <Box key={dx} args={[0.04, 0.05, 0.4]} position={[dx, 0.025, 0]} color="#111" />
        ))}
        <TableLamp position={[-0.55, 0.71, 0.02]} scale={1.15} />
        <group position={[0.58, 0.71, 0]}>
          <Cyl args={[0.05, 0.06, 0.03, 16]} position={[0, 0.015, 0]} color="#111" metalness={0.6} />
          <mesh position={[0, 0.17, 0]}>
            <sphereGeometry args={[0.13, 32, 20]} />
            <meshStandardMaterial color="#141414" roughness={0.3} metalness={0.2} />
          </mesh>
        </group>
        <Box args={[0.28, 0.04, 0.2]} position={[0.15, 0.73, 0.03]} rotation-y={0.12} color="#b8322a" />
        <Box args={[0.25, 0.035, 0.19]} position={[0.15, 0.77, 0.03]} rotation-y={-0.06} color="#efe7da" />
        <SmallPlant position={[0.82, 0.71, 0.12]} seed={31} scale={1.3} trailing />
      </group>
    </group>
  )
}
