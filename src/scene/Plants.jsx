import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from './textures'
import { Cyl } from './parts'

// Leaf blade: base at the origin, grows along +y, arches towards +z and cups slightly.
function leafGeometry(len, wid, bend, tipPow = 0.8) {
  const g = new THREE.PlaneGeometry(1, 1, 4, 14)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const t = p.getY(i) + 0.5
    const prof = Math.sin(Math.PI * Math.pow(t, tipPow))
    p.setXYZ(i, x * wid * prof, t * len * (1 - t * bend * 0.25), t * t * bend * len - x * x * wid * 0.5)
  }
  g.computeVertexNormals()
  return g
}

const leafMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide })

function Pot({ r = 0.2, h = 0.4, color = '#e9e4dc' }) {
  return (
    <group>
      <Cyl args={[r, r * 0.78, h, 28]} position={[0, h / 2, 0]} color={color} roughness={0.5} />
      <Cyl args={[r * 0.93, r * 0.93, 0.01, 24]} position={[0, h - 0.02, 0]} color="#2a1b12" roughness={1} />
    </group>
  )
}

function Sway({ amount = 0.02, speed = 0.6, children, ...props }) {
  const ref = useRef()
  const ph = useMemo(() => Math.random() * 10, [])
  useFrame((s) => {
    const t = s.clock.elapsedTime * speed + ph
    ref.current.rotation.z = Math.sin(t) * amount
    ref.current.rotation.x = Math.sin(t * 0.7) * amount * 0.6
  })
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}

// Bird of paradise / banana plant with big paddle leaves.
export function BigLeafPlant({ seed = 1, height = 1.9, pot = '#e9e4dc', ...props }) {
  const { leaves, geo, mats } = useMemo(() => {
    const r = rng(seed)
    const geo = leafGeometry(0.75, 0.28, 0.35)
    const mats = ['#2f5a2a', '#3d6e31', '#4b7d36'].map(leafMat)
    const leaves = Array.from({ length: 9 }, (_, i) => ({
      yaw: i * 2.4 + r(),
      tilt: 0.12 + r() * 0.42,
      stem: (0.55 + r() * 0.45) * height * 0.62,
      twist: (r() - 0.5) * 0.8,
      s: 0.8 + r() * 0.45,
      m: Math.floor(r() * 3),
    }))
    return { leaves, geo, mats }
  }, [seed, height])
  return (
    <group {...props}>
      <Pot color={pot} />
      <Sway amount={0.015} position={[0, 0.38, 0]}>
        {leaves.map((l, i) => (
          <group key={i} rotation-y={l.yaw}>
            <group rotation-x={l.tilt}>
              <Cyl args={[0.008, 0.012, l.stem, 6]} position={[0, l.stem / 2, 0]} color="#5c6b32" />
              <mesh geometry={geo} material={mats[l.m]} position={[0, l.stem, 0]} rotation={[0.15, l.twist, 0]} scale={l.s} />
            </group>
          </group>
        ))}
      </Sway>
    </group>
  )
}

// Tall bamboo-palm with canes and many narrow leaves (instanced).
export function Bamboo({ seed = 4, height = 2.4, ...props }) {
  const ref = useRef()
  const r = useMemo(() => rng(seed), [seed])
  const canes = useMemo(() => Array.from({ length: 6 }, () => [(r() - 0.5) * 0.22, (r() - 0.5) * 0.22, height * (0.7 + r() * 0.3), (r() - 0.5) * 0.12]), [])
  const geo = useMemo(() => leafGeometry(0.26, 0.05, 0.6, 0.6), [])
  const count = 260
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const [cx, cz, h, lean] = canes[i % canes.length]
      const y = 0.45 + h * (0.3 + r() * 0.7)
      e.set(0.5 + r() * 0.9, r() * Math.PI * 2, 0, 'YXZ')
      q.setFromEuler(e)
      const s = 0.8 + r() * 0.6
      m.compose(new THREE.Vector3(cx + lean * (y / h), y, cz), q, new THREE.Vector3(s, s, s))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.setHSL(0.26 + r() * 0.06, 0.45, 0.22 + r() * 0.12))
    }
    ref.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <group {...props}>
      <Pot r={0.24} h={0.45} color="#141414" />
      <Sway amount={0.012} speed={0.45}>
        {canes.map(([x, z, h, lean], i) => (
          <mesh key={i} position={[x + lean / 2, 0.45 + h / 2, z]} rotation-z={-lean / h}>
            <cylinderGeometry args={[0.012, 0.016, h, 6]} />
            <meshStandardMaterial color="#6f7a3a" roughness={0.7} />
          </mesh>
        ))}
        <instancedMesh ref={ref} args={[geo, null, count]}>
          <meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} />
        </instancedMesh>
      </Sway>
    </group>
  )
}

// Small succulent / pothos for shelves and desks.
export function SmallPlant({ seed = 2, trailing = false, ...props }) {
  const geo = useMemo(() => leafGeometry(0.07, 0.045, 0.5), [])
  const leaves = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: trailing ? 26 : 12 }, (_, i) => {
      if (trailing) return { p: [(r() - 0.5) * 0.12, 0.08 - i * 0.022, 0.06 + r() * 0.03], rot: [1.8 + r(), r() * 6, 0] }
      return { p: [0, 0.07, 0], rot: [0.3 + r() * 0.9, i * 2.4, 0] }
    })
  }, [seed, trailing])
  return (
    <group {...props}>
      <Cyl args={[0.045, 0.035, 0.08, 16]} position={[0, 0.04, 0]} color="#d8cfc2" roughness={0.5} />
      {leaves.map((l, i) => (
        <mesh key={i} geometry={geo} position={l.p} rotation={[l.rot[0], l.rot[1], 0, 'YXZ']}>
          <meshStandardMaterial color={i % 3 ? '#4f7f3a' : '#6a9a48'} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function Plants() {
  return (
    <group>
      <BigLeafPlant position={[-0.2, 0, -4.35]} seed={3} height={2.1} />
      <BigLeafPlant position={[3.82, 0, -4.5]} seed={8} height={2.0} pot="#1a1a1a" />
      <BigLeafPlant position={[-5.45, 0, -0.95]} seed={13} height={1.6} />
      {/* beside the window, not in front of it */}
      <Bamboo position={[5.5, 0, -0.35]} seed={9} height={2.0} />
    </group>
  )
}
