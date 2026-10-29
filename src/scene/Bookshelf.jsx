import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rng, woodGrain } from './textures'
import { Box, Cyl, Glow } from './parts'
import { Clickable } from './Interactive'
import { SmallPlant } from './Plants'

// Built-in shelving along the left wall, filled with books.
const SHELVES = [0.08, 0.56, 1.04, 1.52, 2.0, 2.48, 2.96]
const FRONT = -5.6 // x of the shelf front edge (wall is at x = -6)
const DEPTH = 0.38
const PALETTE = ['#b8322a', '#e0662a', '#f1e4cc', '#2b3f5c', '#1f1f22', '#d9a441', '#3e6b56', '#8c3b4d', '#c7b9a3', '#5b4a7a', '#e8d9b8', '#2f2a26']

// Defaults fill the left wall; smaller copies are used as freestanding units.
export function Bookshelf({ offset = [0, 0, 0], z0: Z0 = -0.75, z1: Z1 = 4.45, bays: BAYS = 4, seed = 42, lamp = true }) {
  const ref = useRef()
  const wood = useMemo(() => woodGrain('shelf', 22, 18), [])
  const bay = (Z1 - Z0) / BAYS

  const { books, decor } = useMemo(() => {
    const r = rng(seed)
    const books = []
    const decor = []
    SHELVES.slice(0, -1).forEach((y, si) => {
      for (let b = 0; b < BAYS; b++) {
        const start = Z0 + b * bay + 0.03
        const end = start + bay - 0.06
        // leave a gap in some bays for an object
        const gapAt = r() < 0.75 ? start + r() * (bay - 0.4) : null
        let z = start
        let lean = 0
        while (z < end - 0.03) {
          if (gapAt !== null && z > gapAt && z < gapAt + 0.32) {
            decor.push({ z: gapAt + 0.16, y, kind: Math.floor(r() * 4) })
            z = gapAt + 0.34
            continue
          }
          if (r() < 0.07) {
            // horizontal stack
            const n = 2 + Math.floor(r() * 3)
            for (let k = 0; k < n; k++) {
              books.push({ pos: [FRONT - 0.13, y + 0.02 + k * 0.035, z + 0.12], size: [0.24, 0.033, 0.22 - k * 0.012], rot: [0, r() * 0.2, 0], c: PALETTE[Math.floor(r() * PALETTE.length)] })
            }
            z += 0.27
            continue
          }
          const w = 0.022 + r() * 0.035
          const h = 0.2 + r() * 0.17
          const d = 0.17 + r() * 0.08
          lean = r() < 0.05 && z > start + 0.1 ? 0.22 : 0
          books.push({ pos: [FRONT - d / 2 - 0.01, y + 0.01 + h / 2, z + w / 2 + (lean ? h * 0.1 : 0)], size: [d, h, w], rot: [lean, 0, 0], c: PALETTE[Math.floor(r() * PALETTE.length)] })
          z += w + (lean ? h * 0.22 : 0.002)
          if (lean) z += 0.02
        }
      }
    })
    return { books, decor }
  }, [bay, seed, Z0])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    books.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(...b.rot))
      m.compose(new THREE.Vector3(...b.pos), q, new THREE.Vector3(...b.size))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.set(b.c).offsetHSL(0, 0, (Math.sin(i * 12.9) - 0.5) * 0.04))
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [books])

  const cx = FRONT - DEPTH / 2
  return (
    <Clickable id="story" position={offset}>
      {/* carcass */}
      <Box args={[0.02, SHELVES.at(-1) + 0.04, Z1 - Z0]} position={[-5.99, (SHELVES.at(-1) + 0.04) / 2, (Z0 + Z1) / 2]} color="#120e0b" />
      {SHELVES.map((y) => (
        <Box key={y} args={[DEPTH, 0.035, Z1 - Z0 + 0.04]} position={[cx, y, (Z0 + Z1) / 2]} map={wood} color="#ffffff" roughness={0.5} />
      ))}
      {Array.from({ length: BAYS + 1 }, (_, b) => (
        <Box key={b} args={[DEPTH, SHELVES.at(-1), 0.035]} position={[cx, SHELVES.at(-1) / 2, Z0 + b * bay]} map={wood} color="#ffffff" roughness={0.5} />
      ))}
      {/* warm LED strips under each shelf */}
      {SHELVES.slice(1).map((y) => (
        <Glow key={y} args={[0.012, 0.008, Z1 - Z0 - 0.1]} position={[FRONT - 0.03, y - 0.022, (Z0 + Z1) / 2]} color={[2.6, 1.5, 0.7]} />
      ))}
      <instancedMesh ref={ref} args={[null, null, books.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      {decor.map((d, i) => {
        const p = [FRONT - 0.17, d.y + 0.018, d.z]
        if (d.kind === 0) return <SmallPlant key={i} position={p} seed={i + 3} scale={1.3} trailing={i % 3 === 0} />
        if (d.kind === 1) return <Cyl key={i} args={[0.05, 0.07, 0.2, 18]} position={[p[0], p[1] + 0.1, p[2]]} color={i % 2 ? '#e9e4dc' : '#c55a2c'} roughness={0.4} />
        if (d.kind === 2)
          return (
            <mesh key={i} position={[p[0], p[1] + 0.08, p[2]]}>
              <sphereGeometry args={[0.08, 20, 14]} />
              <meshStandardMaterial color="#d8d2c8" roughness={0.3} />
            </mesh>
          )
        return (
          <group key={i} position={[p[0] + 0.05, p[1], p[2]]} rotation-y={Math.PI / 2}>
            <Box args={[0.2, 0.26, 0.02]} position={[0, 0.13, 0]} rotation-x={-0.12} color="#141414" />
            <Box args={[0.16, 0.2, 0.004]} position={[0, 0.13, 0.012]} rotation-x={-0.12} color={['#ff7a3d', '#2fd1c5', '#ff6fae'][i % 3]} />
          </group>
        )
      })}
      {/* globe lamp on a middle shelf */}
      {lamp && <group position={[FRONT - 0.17, SHELVES[2] + 0.02, 2.55]}>
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.1, 24, 16]} />
          <meshBasicMaterial color={[3.4, 2.4, 1.4]} toneMapped={false} />
        </mesh>
        <pointLight position={[0.25, 0.12, 0]} intensity={1.8} distance={2.2} decay={2} color="#ffb067" />
      </group>}
      {/* ladder rail */}
      <Cyl args={[0.012, 0.012, Z1 - Z0]} rotation-x={Math.PI / 2} position={[FRONT + 0.06, 3.0, (Z0 + Z1) / 2]} color="#b08a4a" metalness={0.8} roughness={0.3} />
    </Clickable>
  )
}
