import { useMemo } from 'react'
import * as THREE from 'three'
import { DESK, ROOM } from './views'
import { jute, laptopScreen, phoneScreen, woodGrain } from './textures'
import { Box, Cyl, Glow, Limb, Soft } from './parts'
import { Clickable } from './Interactive'
import { SmallPlant } from './Plants'
import { Designer, Developer } from './Team'

const TOP = 0.765 // desk surface height
const SEAT = 1.6 // distance of each person from the desk centre

function Desk() {
  // grain runs along the length of the desk
  const wood = useMemo(() => {
    const t = woodGrain('desk2', 26, 30).clone()
    t.center.set(0.5, 0.5)
    t.rotation = Math.PI / 2
    t.needsUpdate = true
    return t
  }, [])
  const steel = { color: '#141312', metalness: 0.6, roughness: 0.35 }
  return (
    <group>
      <Soft args={[2.7, 0.055, 1.35]} radius={0.02} position={[0, 0.74, 0]} map={wood} color="#ffffff" roughness={0.4} />
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.52, 0.52].map((z) => (
            <Box key={z} args={[0.05, 0.71, 0.05]} position={[0, 0.355, z]} {...steel} />
          ))}
          <Box args={[0.05, 0.05, 1.1]} position={[0, 0.69, 0]} {...steel} />
          <Box args={[0.07, 0.04, 1.15]} position={[0, 0.02, 0]} {...steel} />
        </group>
      ))}
      <Box args={[1.64, 0.05, 0.05]} position={[0, 0.69, 0]} {...steel} />
    </group>
  )
}

function Chair(props) {
  const mesh = '#1d1d1f'
  return (
    <group {...props}>
      <Soft args={[0.5, 0.08, 0.48]} radius={0.035} position={[0, 0.45, 0.02]} color={mesh} roughness={0.8} />
      <Soft args={[0.46, 0.6, 0.06]} radius={0.03} position={[0, 0.86, -0.25]} rotation-x={-0.12} color={mesh} roughness={0.8} />
      <Cyl args={[0.028, 0.028, 0.32]} position={[0, 0.25, 0]} color="#2b2b2b" metalness={0.8} roughness={0.3} />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i / 5) * Math.PI * 2}>
          <Box args={[0.04, 0.035, 0.32]} position={[0, 0.08, 0.16]} color="#202020" metalness={0.5} />
          <mesh position={[0, 0.03, 0.31]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
      {[-0.27, 0.27].map((x) => (
        <group key={x}>
          <Box args={[0.03, 0.22, 0.03]} position={[x, 0.58, -0.05]} color="#202020" />
          <Soft args={[0.06, 0.03, 0.26]} radius={0.012} position={[x, 0.7, 0.0]} color="#202020" />
        </group>
      ))}
    </group>
  )
}

function Laptop({ variant, ...props }) {
  const screen = useMemo(() => laptopScreen(variant), [variant])
  const alu = { color: '#c3c6cc', metalness: 0.8, roughness: 0.28 }
  return (
    <group {...props}>
      <Soft args={[0.34, 0.016, 0.235]} radius={0.006} position={[0, 0.008, 0]} {...alu} />
      <Box args={[0.28, 0.002, 0.1]} position={[0, 0.017, -0.035]} color="#2a2b2e" />
      <group position={[0, 0.016, -0.115]} rotation-x={-0.32}>
        <Soft args={[0.34, 0.225, 0.008]} radius={0.004} position={[0, 0.112, 0]} {...alu} />
        <mesh position={[0, 0.114, 0.0045]} userData={{ noShadow: true }}>
          <planeGeometry args={[0.315, 0.2]} />
          <meshBasicMaterial map={screen} color={[1.3, 1.3, 1.3]} toneMapped={false} />
        </mesh>
        {/* glowing logo on the lid */}
        <mesh position={[0, 0.12, -0.0045]} rotation-y={Math.PI} userData={{ noShadow: true }}>
          <circleGeometry args={[0.014, 16]} />
          <meshBasicMaterial color={[2.5, 2.5, 2.5]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Mug({ color, ...props }) {
  return (
    <group {...props}>
      <Cyl args={[0.042, 0.038, 0.1, 20]} position={[0, 0.05, 0]} color={color} roughness={0.35} />
      <Cyl args={[0.036, 0.036, 0.002]} position={[0, 0.093, 0]} color="#2a160c" roughness={0.2} />
      <mesh position={[0.045, 0.05, 0]}>
        <torusGeometry args={[0.025, 0.008, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Bottle(props) {
  return (
    <group {...props}>
      <Cyl args={[0.035, 0.035, 0.2, 20]} position={[0, 0.1, 0]} color="#e9e6e0" roughness={0.3} metalness={0.3} />
      <Cyl args={[0.025, 0.03, 0.04, 16]} position={[0, 0.22, 0]} color="#1a1a1a" roughness={0.5} />
    </group>
  )
}

function Phone(props) {
  const tex = useMemo(() => phoneScreen(), [])
  return (
    <Clickable id="contact" {...props}>
      <Soft args={[0.08, 0.01, 0.16]} radius={0.004} position={[0, 0.005, 0]} color="#1a1a1c" metalness={0.5} roughness={0.3} />
      <mesh position={[0, 0.0105, 0]} rotation-x={-Math.PI / 2} userData={{ noShadow: true }}>
        <planeGeometry args={[0.072, 0.15]} />
        <meshBasicMaterial map={tex} color={[1.2, 1.2, 1.2]} toneMapped={false} />
      </mesh>
    </Clickable>
  )
}

// Black drum pendants over the desk, glowing from underneath.
function Pendants() {
  const drops = [
    // kept left of centre so they never cover the sign from the main view
    [-1.05, 2.12],
    [-0.4, 2.0],
    [0.25, 2.12],
  ]
  return (
    <group position={[DESK[0], 0, DESK[2]]}>
      {drops.map(([x, y], i) => (
        <group key={i} position={[x, 0, 0]}>
          <Cyl args={[0.004, 0.004, ROOM.H - y]} position={[0, (ROOM.H + y) / 2, 0]} color="#111" roughness={1} />
          <Cyl args={[0.02, 0.02, 0.05]} position={[0, y + 0.02, 0]} color="#151515" metalness={0.5} />
          {/* matte black drum shade, glowing from below */}
          <mesh position={[0, y - 0.09, 0]}>
            <cylinderGeometry args={[0.1, 0.11, 0.17, 36, 1, true]} />
            <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>
          <Cyl args={[0.1, 0.1, 0.01, 36]} position={[0, y - 0.005, 0]} color="#141414" roughness={0.55} />
          <mesh position={[0, y - 0.17, 0]} rotation-x={Math.PI / 2} userData={{ noShadow: true }}>
            <circleGeometry args={[0.105, 36]} />
            <meshBasicMaterial color={[5, 3, 1.5]} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <pointLight position={[-0.4, 1.7, 0]} intensity={4} distance={4} decay={2} color="#ffb067" />
    </group>
  )
}

export function Workspace() {
  const rug = useMemo(() => jute('desk', '#7d6851'), [])
  return (
    <group>
      <mesh position={[DESK[0], 0.013, DESK[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[5.2, 3.0]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <group position={DESK}>
        <Desk />
        <Chair position={[-SEAT - 0.03, 0, 0.15]} rotation-y={Math.PI / 2} />
        <Developer position={[-SEAT, 0, 0.15]} rotation-y={Math.PI / 2} />
        <Chair position={[SEAT + 0.03, 0, -0.12]} rotation-y={-Math.PI / 2} />
        <Designer position={[SEAT, 0, -0.12]} rotation-y={-Math.PI / 2} />

        {/* Vinay's laptop opens Services, Shruti's opens Projects */}
        <Clickable id="services">
          <Laptop variant="design" position={[-1.08, TOP, 0.15]} rotation-y={-Math.PI / 2} />
        </Clickable>
        <Clickable id="projects">
          <Laptop variant="projects" position={[1.08, TOP, -0.12]} rotation-y={Math.PI / 2} />
        </Clickable>

        <SmallPlant position={[0, TOP, -0.05]} seed={17} scale={2.6} />
        <Mug color="#1c1c1e" position={[-0.72, TOP, 0.5]} />
        <Mug color="#f1ece4" position={[0.7, TOP, 0.32]} rotation-y={2} />
        <Bottle position={[0.35, TOP, -0.45]} />
        <Bottle position={[0.48, TOP, -0.38]} scale={0.85} />
        <Phone position={[-0.3, TOP, 0.42]} rotation-y={0.35} />
        {/* books, notebook, pen cup */}
        <Box args={[0.26, 0.04, 0.19]} position={[-0.42, TOP + 0.02, -0.35]} rotation-y={0.15} color="#e4d9c6" />
        <Box args={[0.24, 0.035, 0.18]} position={[-0.42, TOP + 0.058, -0.35]} rotation-y={-0.05} color="#7d2a1d" />
        <Box args={[0.22, 0.03, 0.17]} position={[-0.42, TOP + 0.09, -0.35]} rotation-y={0.08} color="#2f3a2c" />
        <Box args={[0.21, 0.014, 0.29]} position={[0.55, TOP + 0.007, 0.48]} rotation-y={-0.3} color="#c9a46a" roughness={0.8} />
        <group position={[0.22, TOP, 0.25]}>
          <Cyl args={[0.035, 0.035, 0.1, 18]} position={[0, 0.05, 0]} color="#1b1b1b" roughness={0.5} />
          {[-0.4, 0, 0.4].map((r) => (
            <Cyl key={r} args={[0.004, 0.004, 0.15]} position={[r * 0.02, 0.12, 0]} rotation-z={r * 0.3} color={r ? '#f0b429' : '#c4471f'} />
          ))}
        </group>
      </group>
      <Pendants />
    </group>
  )
}
