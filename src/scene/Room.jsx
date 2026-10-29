import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { LAYOUT, ROOM } from './views'
import { bwArt, plaster, poster, woodFloor, woodGrain } from './textures'
import { Box, Cyl, Glow } from './parts'

const { W, D, H } = ROOM
const WALL = '#2c2826'

function Wall({ size, color = WALL, ...props }) {
  const map = useMemo(() => plaster(), [])
  return (
    <mesh {...props}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={map} color={color} roughness={0.95} />
    </mesh>
  )
}

export function SlatWall({ x0 = LAYOUT.slats[0], x1 = LAYOUT.slats[1] }) {
  const ref = useRef()
  const map = useMemo(() => woodGrain('slat', 24, 30), [])
  const step = 0.07
  const count = Math.floor((x1 - x0) / step)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      m.makeTranslation(x0 + i * step + step / 2, H / 2, -D / 2 + 0.05)
      ref.current.setMatrixAt(i, m)
      c.setHSL(0.075, 0.36, 0.36 + ((i * 7919) % 13) / 300)
      ref.current.setColorAt(i, c)
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [count])
  return (
    <group>
      <Box args={[x1 - x0, H, 0.02]} position={[(x0 + x1) / 2, H / 2, -D / 2 + 0.012]} color="#0c0806" roughness={1} />
      <instancedMesh ref={ref} args={[null, null, count]}>
        <boxGeometry args={[0.046, H, 0.055]} />
        <meshStandardMaterial map={map} roughness={0.55} />
      </instancedMesh>
      {/* hidden cove light along the ceiling */}
      <Glow args={[x1 - x0, 0.02, 0.03]} position={[(x0 + x1) / 2, H - 0.07, -D / 2 + 0.16]} color={[4, 2.3, 1]} />
      <Box args={[x1 - x0 + 0.1, 0.12, 0.2]} position={[(x0 + x1) / 2, H - 0.04, -D / 2 + 0.12]} color="#0e0b09" />
    </group>
  )
}

function curtainGeometry(width, height, folds) {
  const g = new THREE.PlaneGeometry(width, height, folds * 14, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / width
    p.setZ(i, Math.sin(x * folds * Math.PI * 2) * 0.05 + Math.sin(x * folds * 5.1) * 0.012)
  }
  g.computeVertexNormals()
  return g
}

function Curtain({ width, folds, ...props }) {
  const geo = useMemo(() => curtainGeometry(width, H - 0.12, folds), [width, folds])
  return (
    <group {...props}>
      <mesh geometry={geo} position={[0, (H - 0.12) / 2 + 0.02, 0]}>
        <meshStandardMaterial color="#d9bfa6" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <Cyl args={[0.015, 0.015, width + 0.1]} rotation-z={Math.PI / 2} position={[0, H - 0.08, 0.04]} color="#1a1715" metalness={0.6} />
    </group>
  )
}

function Frame({ map, size, ...props }) {
  const [w, h] = size
  return (
    <group {...props}>
      <Box args={[w + 0.07, h + 0.07, 0.035]} color="#2b1d12" roughness={0.6} />
      <mesh position-z={0.019}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
    </group>
  )
}

// Ceiling track with spot cans, as in a gallery / studio.
function Track({ z, from, to, cans }) {
  return (
    <group>
      <Box args={[to - from, 0.035, 0.05]} position={[(from + to) / 2, H - 0.03, z]} color="#0d0d0d" metalness={0.5} roughness={0.4} />
      {cans.map(([x, tilt, yaw = 0]) => (
        <group key={x} position={[x, H - 0.1, z]} rotation={[tilt, yaw, 0]}>
          <Cyl args={[0.004, 0.004, 0.1]} position={[0, 0.05, 0]} color="#111" />
          <Cyl args={[0.045, 0.05, 0.16, 18]} position={[0, -0.06, 0]} color="#121212" metalness={0.5} roughness={0.4} />
          <Glow geometry="sphere" args={[0.032, 12, 6]} position={[0, -0.14, 0]} scale={[1, 0.25, 1]} color={[6, 3.6, 1.8]} />
        </group>
      ))}
    </group>
  )
}

export function Room() {
  const floor = useMemo(() => woodFloor(), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 2]}>
        <planeGeometry args={[W, 14]} />
        {/* lightly glossy wood: picks up soft highlights from the environment without redrawing the room */}
        <meshStandardMaterial map={floor} color="#b9a08a" roughness={0.42} metalness={0} envMapIntensity={1.6} />
      </mesh>
      <Wall size={[W, H]} position={[0, H / 2, -D / 2]} />
      <Wall size={[D, H]} position={[-W / 2, H / 2, 0]} rotation-y={Math.PI / 2} />
      <Wall size={[D, H]} position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2} color="#231f1d" />
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#141110" roughness={1} />
      </mesh>
      {/* skirting */}
      <Box args={[W, 0.1, 0.02]} position={[0, 0.05, -D / 2 + 0.01]} color="#120f0d" />
      <Box args={[0.02, 0.1, D]} position={[-W / 2 + 0.01, 0.05, 0]} color="#120f0d" />
      <Box args={[0.02, 0.1, D]} position={[W / 2 - 0.01, 0.05, 0]} color="#120f0d" />
      <SlatWall />
      <Curtain width={LAYOUT.curtain[1] - LAYOUT.curtain[0] - 0.1} folds={8} position={[(LAYOUT.curtain[0] + LAYOUT.curtain[1]) / 2, 0, -D / 2 + 0.09]} />
      <Curtain width={2.6} folds={8} position={[-W / 2 + 0.09, 0, -3.5]} rotation-y={Math.PI / 2} />
      <Frame map={bwArt()} size={[0.95, 1.25]} position={[LAYOUT.art, 2.25, -D / 2 + 0.03]} />
      <Frame map={poster()} size={[0.6, 0.83]} position={[LAYOUT.poster, 2.05, -D / 2 + 0.03]} />
      <Track z={-2.4} from={-0.2} to={5.6} cans={[[0.9, -0.55], [2.6, -0.55], [4.85, -0.5]]} />
      <Track z={-3.4} from={-5.6} to={-0.6} cans={[[-4.6, -0.35], [-2.65, -0.45], [-1.0, -0.4]]} />
      <Track z={2.4} from={-5} to={5} cans={[[-4.3, 0.2, 1.2], [0.2, 0.45], [3.8, 0.3]]} />
    </group>
  )
}
