import { useMemo } from 'react'
import * as THREE from 'three'
import { check, fabric, jute, marble, woodGrain } from './textures'
import { Box, Cyl, Glow, Limb, Soft } from './parts'
import { SmallPlant } from './Plants'
import { Clickable } from './Interactive'
import { LAYOUT } from './views'

const SOFA = '#a7a39e'
const RUST = '#b4501f'

function Pillow({ color, map, args = [0.46, 0.44, 0.16], ...props }) {
  return <Soft args={args} radius={0.075} color={color} map={map} roughness={1} {...props} />
}

// L-shaped modular sofa tucked into the back-left corner.
function Couch() {
  const tex = useMemo(() => fabric('sofa3', '#d6d3cf', [4, 2]), [])
  const knit = useMemo(() => fabric('knit', '#d07a3c', [2, 2]), [])
  const sofa = (args, position, r = 0.05) => <Soft args={args} position={position} radius={r} map={tex} color={SOFA} />
  return (
    <group>
      {/* back run */}
      {sofa([3.9, 0.36, 0.98], [-4.0, 0.24, -4.42])}
      {sofa([3.9, 0.5, 0.26], [-4.0, 0.66, -4.8], 0.09)}
      {[-5.3, -4.0, -2.7].map((x) => (
        <Soft key={x} args={[1.27, 0.16, 0.74]} radius={0.07} position={[x, 0.48, -4.25]} map={tex} color="#b2aea8" />
      ))}
      {sofa([0.22, 0.6, 0.98], [-1.94, 0.33, -4.42], 0.09)}
      {/* side run along the left wall */}
      {sofa([0.98, 0.36, 2.35], [-5.42, 0.24, -2.75])}
      {sofa([0.26, 0.5, 2.35], [-5.8, 0.66, -2.75], 0.09)}
      {[-3.35, -2.15].map((z) => (
        <Soft key={z} args={[0.74, 0.16, 1.17]} radius={0.07} position={[-5.25, 0.48, z]} map={tex} color="#b2aea8" />
      ))}
      {sofa([0.98, 0.6, 0.22], [-5.42, 0.33, -1.5], 0.09)}
      {[
        [-5.85, -4.85],
        [-2.1, -4.85],
        [-2.1, -3.98],
        [-5.85, -1.65],
        [-4.98, -1.65],
      ].map(([x, z], i) => (
        <Cyl key={i} args={[0.03, 0.025, 0.06]} position={[x, 0.03, z]} color="#1b1410" />
      ))}
      <Pillow color={RUST} map={knit} position={[-4.85, 0.8, -4.58]} rotation={[-0.25, 0.1, 0.05]} />
      <Pillow color="#ffffff" map={check()} position={[-3.75, 0.8, -4.6]} rotation={[-0.25, -0.12, -0.04]} />
      <Pillow color={RUST} position={[-2.6, 0.8, -4.58]} rotation={[-0.25, -0.05, 0.08]} />
      <Pillow color="#d58a4c" map={knit} position={[-5.58, 0.8, -3.55]} rotation={[0.08, Math.PI / 2 + 0.2, 0.25]} />
      <Pillow color={RUST} position={[-5.58, 0.8, -2.25]} rotation={[0, Math.PI / 2 - 0.1, 0.25]} />
    </group>
  )
}

function CoffeeTable(props) {
  const geo = useMemo(() => {
    const pts = [
      [0, 0],
      [0.27, 0],
      [0.29, 0.04],
      [0.2, 0.16],
      [0.18, 0.27],
      [0.26, 0.38],
      [0.38, 0.42],
      [0.38, 0.46],
      [0, 0.46],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 48)
  }, [])
  return (
    <group {...props}>
      <mesh geometry={geo}>
        <meshStandardMaterial map={marble()} color="#ffffff" roughness={0.45} />
      </mesh>
      <Box args={[0.3, 0.035, 0.22]} position={[0.02, 0.48, 0.05]} rotation-y={0.3} color="#a8321f" />
      <Box args={[0.27, 0.03, 0.2]} position={[0.02, 0.513, 0.05]} rotation-y={0.18} color="#7d2a1d" />
      <Cyl args={[0.04, 0.035, 0.1]} position={[-0.17, 0.51, -0.1]} color="#121212" />
    </group>
  )
}

function Pouf(props) {
  const tex = useMemo(() => fabric('pouf', '#b4501f', [6, 2]), [])
  return (
    <group {...props}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[0.3, 32, 20]} />
        <meshStandardMaterial map={tex} color="#ffffff" roughness={1} />
      </mesh>
      <Cyl args={[0.3, 0.3, 0.2, 32]} position={[0, 0.16, 0]} color="#9e461c" roughness={1} />
    </group>
  )
}

// Arc floor lamp with a glowing dome, leaning over the sofa end.
function FloorLamp(props) {
  return (
    <group {...props}>
      <Cyl args={[0.16, 0.17, 0.03, 28]} position={[0, 0.015, 0]} color="#151311" metalness={0.6} roughness={0.35} />
      <Limb from={[0, 0.02, 0]} to={[0, 1.55, 0]} r={0.012} color="#1a1612" />
      <Limb from={[0, 1.55, 0]} to={[-0.35, 1.72, 0.05]} r={0.011} color="#1a1612" />
      <group position={[-0.42, 1.62, 0.06]}>
        <mesh>
          <sphereGeometry args={[0.19, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#1a1612" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.005, 0]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.18, 32]} />
          <meshBasicMaterial color={[4, 2.6, 1.4]} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, -0.2, 0]} intensity={3.5} distance={3.2} decay={2} color="#ffb067" />
      </group>
    </group>
  )
}

// Tall open shelf with plants, books and a globe lamp.
function TallShelf(props) {
  const wood = useMemo(() => woodGrain('shelf2', 24, 26), [])
  const levels = [0.08, 0.6, 1.12, 1.64, 2.16]
  return (
    <group {...props}>
      {[
        [-0.44, -0.16],
        [0.44, -0.16],
        [-0.44, 0.16],
        [0.44, 0.16],
      ].map(([x, z], i) => (
        <Box key={i} args={[0.022, 2.3, 0.022]} position={[x, 1.15, z]} color="#111" metalness={0.5} roughness={0.4} />
      ))}
      {levels.map((y) => (
        <group key={y}>
          <Box args={[0.9, 0.03, 0.34]} position={[0, y, 0]} map={wood} color="#ffffff" roughness={0.5} />
          {y > 0.1 && <Glow args={[0.84, 0.006, 0.01]} position={[0, y - 0.02, 0.15]} color={[2.2, 1.3, 0.6]} />}
        </group>
      ))}
      {/* contents */}
      <SmallPlant position={[-0.22, 2.18, 0]} seed={4} scale={1.8} trailing />
      <SmallPlant position={[0.22, 2.18, 0.02]} seed={9} scale={1.6} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={i} args={[0.035, 0.26 - (i % 3) * 0.03, 0.2]} position={[-0.3 + i * 0.04, 1.27 - (i % 3) * 0.015, 0]} color={['#c9b48f', '#2f3a2c', '#efe7da', '#a8321f', '#2b3f5c', '#d9a441'][i]} />
      ))}
      <group position={[0.22, 1.13, 0]}>
        <Cyl args={[0.05, 0.06, 0.04, 16]} position={[0, 0.02, 0]} color="#c9a46a" metalness={0.8} roughness={0.3} />
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.11, 24, 16]} />
          <meshBasicMaterial color={[3.4, 2.4, 1.4]} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.15, 0.2]} intensity={1.6} distance={2.2} decay={2} color="#ffb067" />
      </group>
      <SmallPlant position={[-0.15, 0.62, 0]} seed={13} scale={1.8} />
      <Cyl args={[0.06, 0.05, 0.18, 18]} position={[0.2, 0.71, 0]} color="#e9e1d4" roughness={0.4} />
      <Box args={[0.3, 0.12, 0.22]} position={[0, 1.71, 0]} color="#3b2a1d" />
      {/* little yellow toy car */}
      <group position={[-0.2, 1.135, 0.05]} rotation-y={0.4}>
        <Soft args={[0.2, 0.05, 0.09]} radius={0.02} position={[0, 0.045, 0]} color="#f2c230" roughness={0.6} />
        <Soft args={[0.11, 0.045, 0.08]} radius={0.018} position={[-0.01, 0.085, 0]} color="#f2c230" roughness={0.6} />
        {[[-0.06, -0.045], [0.06, -0.045], [-0.06, 0.045], [0.06, 0.045]].map(([x, z], i) => (
          <Cyl key={i} args={[0.02, 0.02, 0.012, 14]} rotation-x={Math.PI / 2} position={[x, 0.02, z]} color="#151515" />
        ))}
      </group>
      <Box args={[0.06, 0.05, 0.04]} position={[0.28, 1.68, 0.05]} color="#1a1a1a" />
      <Cyl args={[0.018, 0.018, 0.04, 12]} rotation-x={Math.PI / 2} position={[0.28, 1.68, 0.08]} color="#333" metalness={0.6} />
      <Box args={[0.42, 0.04, 0.26]} position={[0, 0.12, 0]} color="#c9b48f" />
      <Box args={[0.4, 0.04, 0.25]} position={[0, 0.16, 0]} color="#7d2a1d" />
    </group>
  )
}

export function Lounge() {
  const rugTex = useMemo(() => jute('lounge', '#a99886'), [])
  return (
    <group>
      <mesh position={[-3.6, 0.012, -3.0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.4, 3.4]} />
        <meshStandardMaterial map={rugTex} roughness={1} />
      </mesh>
      {/* the couch is where projects start: it opens "How we work" */}
      <Clickable id="process">
        <Couch />
        <CoffeeTable position={[-3.9, 0.012, -2.75]} />
        <Pouf position={[-4.9, 0.012, -1.75]} />
      </Clickable>
      <FloorLamp position={[-1.62, 0, -4.4]} rotation-y={0.35} />
      <TallShelf position={[LAYOUT.shelf, 0, -4.75]} />
    </group>
  )
}
