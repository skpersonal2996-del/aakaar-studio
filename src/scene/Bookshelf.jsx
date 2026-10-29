import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bookSpine, rng, woodGrain } from './textures'
import { Box, Cyl } from './parts'
import { Clickable } from './Interactive'
import { SmallPlant } from './Plants'

// Built-in shelving along the left wall: the books we actually read, styled like a home shelf,
// with titled spines, plain colourful books, small stacks, lamps and a few objects.
const SHELVES = [0.08, 0.56, 1.04, 1.52, 2.0, 2.48, 2.96]
const FRONT = -5.6 // x of the shelf front edge (wall is at x = -6); spines face +x, into the room
const DEPTH = 0.38
const Z0 = -0.75
const Z1 = 4.45
const BAYS = 4
const BAY = (Z1 - Z0) / BAYS
const PAGES = '#efe6d2'
// plain books: warm reds and oranges, pinks, greens, blues and creams
const PALETTE = ['#c2362b', '#e4572e', '#f08a4b', '#f4c95d', '#efe3c8', '#2f6b4f', '#5c8f5a', '#e98aa6', '#d9485f', '#2c4a7a', '#3f7cac', '#1f1f22', '#8a5a44', '#f6efe2', '#b23a48']

// The titled books. Amish's Shiva Trilogy sits together as one set.
const TITLES = {
  meluha: { title: 'The Immortals of Meluha', author: 'AMISH', bg: '#7a2a1c', ink: '#f3c87a', serif: true },
  nagas: { title: 'The Secret of the Nagas', author: 'AMISH', bg: '#1f4a3a', ink: '#f3c87a', serif: true },
  vayu: { title: 'The Oath of the Vayuputras', author: 'AMISH', bg: '#3b2a5a', ink: '#f3c87a', serif: true },
  alchemist: { title: 'The Alchemist', author: 'Paulo Coelho', bg: '#e8833a', ink: '#fff6e8', serif: true },
  secret: { title: 'The Secret', author: 'Rhonda Byrne', bg: '#5a3a22', ink: '#e9c46a', serif: true },
  laws: { title: 'The 48 Laws of Power', author: 'Robert Greene', bg: '#ece4d2', ink: '#8c1d1d', serif: true },
  ikigai: { title: 'IKIGAI', author: 'García & Miralles', bg: '#f2b8b0', ink: '#2a2a2a' },
  courage: { title: 'The Courage to Be Disliked', author: 'Kishimi & Koga', bg: '#7fb2c9', ink: '#ffffff' },
  naval: { title: 'The Almanack of Naval Ravikant', author: 'Eric Jorgenson', bg: '#1e3a5f', ink: '#f3e9d6' },
  frankl: { title: 'Man’s Search for Meaning', author: 'Viktor E. Frankl', bg: '#2c2c2c', ink: '#f2c14e', serif: true },
  atomic: { title: 'Atomic Habits', author: 'James Clear', bg: '#f4efe6', ink: '#1d1d1d', accent: '#e2a33b' },
  money: { title: 'The Psychology of Money', author: 'Morgan Housel', bg: '#f3f0e8', ink: '#1b4d3e', serif: true },
  now: { title: 'The Power of Now', author: 'Eckhart Tolle', bg: '#e9d6a8', ink: '#3b2b1a', serif: true },
}

// Each shelf (bottom to top) has four bays; each bay lists what stands in it, left to right.
//   up: a row of upright books (a number for plain ones, or titles with `extra` plain ones around them)
//   stack: books lying flat (a number, or titles), optionally with an object on top
//   decor: a single object
// The story camera looks at bays 1 and 2 around eye height, so the titled books live there.
const PLAN = [
  [[{ up: 7 }, { decor: 'disco' }], [{ stack: 3, top: 'bowl' }, { up: 6 }], [{ up: 9 }], [{ decor: 'plant' }, { up: 6 }]],
  [[{ up: 6 }, { decor: 'wavy', color: '#e98aa6' }], [{ decor: 'knot' }, { stack: 2 }, { up: 5 }], [{ up: 5 }, { decor: 'mug' }, { up: 3 }], [{ stack: 4, top: 'lamp' }, { up: 5 }]],
  [
    [{ decor: 'striped' }, { up: 7 }],
    [{ up: ['meluha', 'nagas', 'vayu'], extra: 4 }, { decor: 'lamp', glow: true }],
    [{ stack: ['secret', 'alchemist'], top: 'mug' }, { up: 6 }, { decor: 'plant' }],
    [{ decor: 'knot' }, { up: 6 }, { stack: 2 }],
  ],
  [
    [{ up: 6 }, { decor: 'bowl' }],
    [{ stack: ['courage', 'ikigai', 'laws'], top: 'lamp', color: '#d9485f' }, { up: ['naval', 'frankl'], extra: 3 }],
    [{ up: ['atomic', 'money', 'now'], extra: 4 }, { decor: 'wavy', color: '#f2b8b0' }],
    [{ up: 6 }, { decor: 'lamp', color: '#f4c95d' }],
  ],
  [[{ decor: 'striped' }, { up: 6 }], [{ up: 7 }, { decor: 'plant', trailing: true }], [{ stack: 3, top: 'knot' }, { up: 5 }], [{ decor: 'plant' }, { up: 5 }]],
  [[{ up: 5 }, { decor: 'wavy', color: '#f08a4b' }], [{ decor: 'plant', trailing: true }, { up: 4 }], [{ up: 6 }, { decor: 'disco' }], [{ stack: 3 }, { decor: 'lamp' }]],
]

// footprint along the shelf (z) for each object
const DECOR_W = { disco: 0.16, bowl: 0.2, wavy: 0.14, knot: 0.15, mug: 0.12, lamp: 0.16, plant: 0.2, striped: 0.13 }

function layout() {
  const r = rng(42)
  const plain = [] // instanced: { pos, size, rot, c }
  const titled = [] // individual meshes with a printed spine
  const decor = []
  const pick = () => PALETTE[Math.floor(r() * PALETTE.length)]

  PLAN.forEach((bays, si) => {
    const floor = SHELVES[si] + 0.018
    bays.forEach((items, b) => {
      // size each item first, then spread them across the bay with uneven gaps
      const built = items.map((it) => {
        if (it.up !== undefined) {
          const ids = Array.isArray(it.up) ? it.up : []
          const n = Array.isArray(it.up) ? ids.length + (it.extra || 0) : it.up
          const before = Math.floor((n - ids.length) / 2)
          const books = Array.from({ length: n }, (_, k) => {
            const id = k >= before && k < before + ids.length ? ids[k - before] : null
            return id
              ? { id, w: 0.05 + r() * 0.008, h: 0.29 + r() * 0.04, d: 0.19 + r() * 0.03 }
              : { w: 0.022 + r() * 0.03, h: 0.2 + r() * 0.15, d: 0.15 + r() * 0.08, c: pick() }
          })
          return { kind: 'up', books, width: books.reduce((s, k) => s + k.w + 0.002, 0) }
        }
        if (it.stack !== undefined) {
          const ids = Array.isArray(it.stack) ? it.stack : Array.from({ length: it.stack }, () => null)
          const books = ids.map((id) => (id ? { id, t: 0.048, L: 0.29, d: 0.2 } : { t: 0.028 + r() * 0.02, L: 0.22 + r() * 0.08, d: 0.16 + r() * 0.05, c: pick() }))
          return { kind: 'stack', books, top: it.top, color: it.color, width: Math.max(...books.map((k) => k.L)) }
        }
        return { kind: 'decor', ...it, width: DECOR_W[it.decor] }
      })
      const inner = BAY - 0.1
      const used = built.reduce((s, it) => s + it.width, 0)
      const weights = Array.from({ length: built.length + 1 }, () => 0.6 + r())
      const total = weights.reduce((a, c) => a + c, 0)
      let z = Z0 + b * BAY + 0.05
      built.forEach((it, i) => {
        z += ((inner - used) * weights[i]) / total
        if (it.kind === 'up') {
          let zz = z
          it.books.forEach((k) => {
            const pos = [FRONT - k.d / 2 - 0.01, floor + k.h / 2, zz + k.w / 2]
            if (k.id) titled.push({ ...k, pos, upright: true })
            else plain.push({ pos, size: [k.d, k.h, k.w], rot: [0, 0, 0], c: k.c })
            zz += k.w + 0.002
          })
        } else if (it.kind === 'stack') {
          let y = floor
          it.books.forEach((k, j) => {
            const pos = [FRONT - k.d / 2 - 0.015, y + k.t / 2, z + it.width / 2]
            const rot = [0, (r() - 0.5) * 0.12 * (j % 2 ? 1 : -1), 0]
            if (k.id) titled.push({ ...k, pos, rot, upright: false })
            else plain.push({ pos, size: [k.d, k.t, k.L], rot, c: k.c })
            y += k.t
          })
          if (it.top) decor.push({ decor: it.top, color: it.color, pos: [FRONT - 0.12, y, z + it.width / 2] })
        } else {
          decor.push({ ...it, pos: [FRONT - 0.17, floor, z + it.width / 2] })
        }
        z += it.width
      })
    })
  })
  return { plain, titled, decor }
}

// A book with its title printed on the spine (the +x face, towards the room).
function TitledBook({ id, pos, rot = [0, 0, 0], upright, w, h, d, t, L }) {
  const info = TITLES[id]
  const mats = useMemo(() => {
    const spine = bookSpine({ key: id, ...info, upright, w: upright ? w : L, h: upright ? h : t })
    const cover = new THREE.MeshStandardMaterial({ color: info.bg, roughness: 0.7 })
    const pages = new THREE.MeshStandardMaterial({ color: PAGES, roughness: 0.9 })
    const face = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.65 })
    // box faces: +x, -x, +y, -y, +z, -z
    return upright ? [face, pages, pages, pages, cover, cover] : [face, pages, cover, cover, pages, pages]
  }, [id, info, upright, w, h, t, L])
  const size = upright ? [d, h, w] : [d, t, L]
  return (
    <mesh position={pos} rotation={rot} scale={size} material={mats}>
      <boxGeometry />
    </mesh>
  )
}

// Small objects between the books.
function Decor({ decor: kind, color, glow, trailing, pos, i }) {
  const wavy = useMemo(() => {
    const pts = Array.from({ length: 24 }, (_, k) => {
      const y = (k / 23) * 0.2
      return new THREE.Vector2(0.045 + Math.sin(y * 48) * 0.009 + (k === 0 ? -0.01 : 0), y)
    })
    return new THREE.LatheGeometry(pts, 28)
  }, [])
  const stripes = useMemo(() => {
    if (kind !== 'striped') return null
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 8
    const x = c.getContext('2d')
    for (let k = 0; k < 8; k++) {
      x.fillStyle = k % 2 ? '#1f1f22' : '#f3ede2'
      x.fillRect(k * 8, 0, 8, 8)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(3, 1)
    return t
  }, [kind])

  if (kind === 'plant') return <SmallPlant position={pos} seed={i + 3} scale={1.3} trailing={trailing} />
  if (kind === 'disco')
    return (
      <mesh position={[pos[0], pos[1] + 0.075, pos[2]]}>
        <sphereGeometry args={[0.075, 14, 10]} />
        <meshStandardMaterial color="#d9d9e0" metalness={1} roughness={0.12} flatShading />
      </mesh>
    )
  if (kind === 'bowl')
    return (
      <mesh position={[pos[0], pos[1] + 0.085, pos[2]]} rotation-x={Math.PI}>
        <sphereGeometry args={[0.085, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1f5a35" roughness={0.12} side={THREE.DoubleSide} />
      </mesh>
    )
  if (kind === 'wavy')
    return (
      <mesh geometry={wavy} position={pos}>
        <meshStandardMaterial color={color || '#e98aa6'} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
    )
  if (kind === 'knot')
    return (
      <mesh position={[pos[0], pos[1] + 0.06, pos[2]]} rotation-y={Math.PI / 2}>
        <torusKnotGeometry args={[0.04, 0.016, 64, 10, 2, 3]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.35} />
      </mesh>
    )
  if (kind === 'mug')
    return (
      <group position={pos}>
        <Cyl args={[0.035, 0.032, 0.08, 20]} position-y={0.04} color={color || '#f3ede2'} roughness={0.35} />
        <mesh position={[0, 0.042, -0.04]}>
          <torusGeometry args={[0.02, 0.006, 8, 16]} />
          <meshStandardMaterial color={color || '#f3ede2'} roughness={0.35} />
        </mesh>
        <Cyl args={[0.0355, 0.0355, 0.012, 20]} position-y={0.055} color="#c2362b" roughness={0.35} />
      </group>
    )
  if (kind === 'striped')
    return (
      <mesh position={[pos[0], pos[1] + 0.09, pos[2]]}>
        <cylinderGeometry args={[0.04, 0.05, 0.18, 24]} />
        <meshStandardMaterial map={stripes} roughness={0.4} />
      </mesh>
    )
  // mushroom lamp: a glowing one carries the shelf's single warm light
  const shade = color || '#d9485f'
  return (
    <group position={pos}>
      <Cyl args={[0.045, 0.05, 0.015, 24]} position-y={0.008} color={glow ? '#f4c95d' : shade} roughness={0.3} />
      <Cyl args={[0.012, 0.014, 0.13, 12]} position-y={0.08} color={glow ? '#f4c95d' : shade} roughness={0.3} />
      <mesh position-y={0.135}>
        <sphereGeometry args={[0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {glow ? <meshBasicMaterial color={[3.2, 2.3, 1.2]} toneMapped={false} /> : <meshStandardMaterial color={shade} roughness={0.25} />}
      </mesh>
      {glow && <pointLight position={[0.25, 0.14, 0]} intensity={1.8} distance={2.2} decay={2} color="#ffb067" />}
    </group>
  )
}

export function Bookshelf() {
  const ref = useRef()
  const wood = useMemo(() => woodGrain('shelf', 22, 18), [])
  const { plain, titled, decor } = useMemo(layout, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    plain.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(...b.rot))
      m.compose(new THREE.Vector3(...b.pos), q, new THREE.Vector3(...b.size))
      ref.current.setMatrixAt(i, m)
      ref.current.setColorAt(i, c.set(b.c).offsetHSL(0, 0, (Math.sin(i * 12.9) - 0.5) * 0.04))
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [plain])

  const cx = FRONT - DEPTH / 2
  return (
    <Clickable id="story">
      {/* carcass */}
      <Box args={[0.02, SHELVES.at(-1) + 0.04, Z1 - Z0]} position={[-5.99, (SHELVES.at(-1) + 0.04) / 2, (Z0 + Z1) / 2]} color="#120e0b" />
      {SHELVES.map((y) => (
        <Box key={y} args={[DEPTH, 0.035, Z1 - Z0 + 0.04]} position={[cx, y, (Z0 + Z1) / 2]} map={wood} color="#ffffff" roughness={0.5} />
      ))}
      {Array.from({ length: BAYS + 1 }, (_, b) => (
        <Box key={b} args={[DEPTH, SHELVES.at(-1), 0.035]} position={[cx, SHELVES.at(-1) / 2, Z0 + b * BAY]} map={wood} color="#ffffff" roughness={0.5} />
      ))}
      {/* warm LED strips under each shelf */}
      {SHELVES.slice(1).map((y) => (
        <mesh key={y} position={[FRONT - 0.03, y - 0.022, (Z0 + Z1) / 2]} userData={{ noShadow: true }}>
          <boxGeometry args={[0.012, 0.008, Z1 - Z0 - 0.1]} />
          <meshBasicMaterial color={[2.6, 1.5, 0.7]} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[null, null, plain.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      {titled.map((b) => (
        <TitledBook key={b.id} {...b} />
      ))}
      {decor.map((d, i) => (
        <Decor key={i} i={i} {...d} />
      ))}
      {/* ladder rail */}
      <Cyl args={[0.012, 0.012, Z1 - Z0]} rotation-x={Math.PI / 2} position={[FRONT + 0.06, 3.0, (Z0 + Z1) / 2]} color="#b08a4a" metalness={0.8} roughness={0.3} />
    </Clickable>
  )
}
