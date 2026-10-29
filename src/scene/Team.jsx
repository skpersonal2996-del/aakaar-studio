import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { DESIGNER, DEVELOPER } from '../content'
import { useStore } from '../store'
import { knitBump, rng } from './textures'
import { Limb, Soft } from './parts'

// The two people who run the studio, in the clay style of the character sheets: round heads,
// two small glossy oval eyes, no mouth or nose, sculpted hair masses, plain sweaters, simple
// trousers and white sneakers. Both sit facing +z and type; hover or click to meet them.

const DEV_LOOK = {
  skin: '#f0b68e',
  hair: '#21130d',
  hairLight: '#2d1b12',
  sweater: '#232224',
  pants: '#3b3b3e',
  legWidth: 0.076,
  shoes: '#eeeae4',
}

const DESIGN_LOOK = {
  skin: '#f3bd96',
  hair: '#24150e',
  hairLight: '#301c13',
  sweater: '#eee5d5',
  pants: '#8a6a4c',
  legWidth: 0.088, // wide-leg trousers
  shoes: '#eeeae4',
}

const HEAD_R = 0.16

// Lumpy unit sphere: one rounded clump of hair.
const clumpGeometry = (() => {
  const g = new THREE.SphereGeometry(1, 28, 20)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    v.multiplyScalar(1 + 0.1 * Math.sin(v.x * 4 + 1) * Math.sin(v.y * 3.5 + 2) * Math.sin(v.z * 4.2))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
})()

// Slightly squashed head with a soft jaw.
const headGeometry = (() => {
  const g = new THREE.SphereGeometry(HEAD_R, 56, 40)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    const y = p.getY(i) * 0.95
    let z = p.getZ(i)
    if (y < 0) {
      const k = 1 - 0.12 * (y / HEAD_R) ** 2
      x *= k
      z *= k
    }
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
})()

// Oversized sweater: hem → chest → dropped shoulders.
const torsoGeometry = new THREE.LatheGeometry(
  [
    [0, -0.02],
    [0.17, -0.02],
    [0.185, 0.04],
    [0.18, 0.18],
    [0.197, 0.33],
    [0.2, 0.41],
    [0.16, 0.48],
    [0.09, 0.515],
    [0, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  40,
)

// Short neck, tucked into both the collar and the jaw.
const neckGeometry = new THREE.LatheGeometry(
  [
    [0, 0],
    [0.066, 0],
    [0.058, 0.07],
    [0.058, 0.14],
    [0, 0.14],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  24,
)

// A short, chunky curly mop: a cap plus rounded clumps, tumbling forward into a fringe.
function CurlyHair({ mat, matLight }) {
  const clumps = useMemo(() => {
    const r = rng(19)
    const up = new THREE.Vector3(0, 1, 0)
    const out = []
    const n = 34
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.2
      const rad = Math.sqrt(Math.max(0, 1 - y * y))
      const az = i * 2.39996
      const dir = new THREE.Vector3(Math.cos(az) * rad, y, Math.sin(az) * rad)
      if (dir.z > 0.4 && dir.y < 0.45) continue // keep the face open
      if (dir.y < 0.1 && dir.z > -0.35) continue // short sides, ears clear
      if (dir.y < -0.25) continue
      const s = (dir.y > 0.5 ? 0.06 : 0.047) + r() * 0.016
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir).multiply(new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI))
      out.push({ p: dir.multiplyScalar(HEAD_R * 0.98 + s * 0.3), q, s: [s * 1.25, s * 0.72, s], light: r() > 0.5 })
    }
    // fringe falling over the forehead
    ;[
      [-0.07, 0.11, 0.105, 0.05],
      [-0.01, 0.12, 0.112, 0.054],
      [0.055, 0.112, 0.105, 0.05],
      [0.105, 0.085, 0.085, 0.042],
      [0.0, 0.088, 0.13, 0.04],
    ].forEach(([x, y, z, s], i) => {
      const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(x, y + 0.05, z).normalize())
      out.push({ p: new THREE.Vector3(x, y, z), q, s: [s * 1.2, s * 0.75, s * 1.05], light: i % 2 === 1 })
    })
    return out
  }, [])
  return (
    <group>
      <mesh material={mat} position={[0, 0.006, -0.012]} rotation-x={-0.32}>
        <sphereGeometry args={[HEAD_R * 1.025, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
      </mesh>
      {clumps.map((c, i) => (
        <mesh key={i} geometry={clumpGeometry} material={c.light ? matLight : mat} position={c.p} quaternion={c.q} scale={c.s} />
      ))}
    </group>
  )
}

// Shoulder → elbow → mitten hand, posed resting at the keyboard.
function Arm({ side: s, m, pivot, color }) {
  return (
    <group ref={pivot} rotation={[-0.5, 0, 0.06 * s]}>
      <mesh material={m.sweater} scale={[1, 0.9, 1]}>
        <sphereGeometry args={[0.076, 20, 16]} />
      </mesh>
      <Limb from={[0, 0, 0]} to={[0, -0.25, 0]} r={0.064} color={color} roughness={0.95} />
      <group position={[0, -0.25, 0]} rotation={[0.45, -0.28 * s, 0]}>
        <mesh material={m.sweater}>
          <sphereGeometry args={[0.062, 18, 14]} />
        </mesh>
        <Limb from={[0, 0, 0]} to={[0, 0, 0.27]} r={0.056} color={color} roughness={0.95} />
        <mesh material={m.sweater} position={[0, 0, 0.28]}>
          <torusGeometry args={[0.049, 0.015, 10, 20]} />
        </mesh>
        <group position={[0, -0.005, 0.335]}>
          <mesh material={m.skin} scale={[1, 0.55, 1.15]}>
            <sphereGeometry args={[0.045, 20, 14]} />
          </mesh>
          <mesh material={m.skin} position={[-s * 0.04, 0.008, -0.01]} scale={[0.8, 0.8, 1.3]}>
            <sphereGeometry args={[0.018, 12, 10]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function SeatedPerson({ look, Hair, intro, peekId, phase = 0, ...props }) {
  const torso = useRef()
  const head = useRef()
  const eyes = useRef()
  const armL = useRef()
  const armR = useRef()
  const nextBlink = useRef(3)
  const [hover, setHover] = useState(false)
  const active = useStore((s) => s.active)
  const peeking = useStore((s) => s.peek === peekId)
  const setPeek = useStore((s) => s.setPeek)
  useCursor(hover && !active && !peeking)

  const m = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.78 }),
      hair: new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.7 }),
      hairLight: new THREE.MeshStandardMaterial({ color: look.hairLight, roughness: 0.68 }),
      sweater: new THREE.MeshStandardMaterial({ color: look.sweater, roughness: 0.95, bumpMap: knitBump(), bumpScale: 1.2 }),
      eye: new THREE.MeshPhysicalMaterial({ color: '#0d0907', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }),
    [look],
  )

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime + phase
    // breathing, a slow head drift, and typing in bursts
    torso.current.scale.y = 1 + Math.sin(t * 1.3) * 0.008
    head.current.rotation.x = 0.22 + Math.sin(t * 0.5) * 0.025
    head.current.rotation.y = Math.sin(t * 0.33) * 0.07
    // steady typing with short pauses; each hand taps on its own rhythm
    const typing = 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.45))
    armL.current.rotation.x = -0.5 + Math.abs(Math.sin(t * 11)) * 0.035 * typing
    armR.current.rotation.x = -0.5 + Math.abs(Math.sin(t * 11 + 1.9)) * 0.035 * typing
    // blink every 3–6 s; clamped so a long frame (e.g. when the tooltip mounts) can't overshoot and stretch the eyes
    nextBlink.current -= Math.min(dt, 0.05)
    if (nextBlink.current <= 0) nextBlink.current = 3 + Math.random() * 3
    const b = nextBlink.current
    eyes.current.scale.y = b < 0.14 ? THREE.MathUtils.clamp(Math.abs(b - 0.07) / 0.07, 0.08, 1) : 1
  })

  return (
    <group
      {...props}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (active || e.delta > 6) return
        setPeek(peekId) // just lean in a little and introduce them
      }}>
      {/* trousers and sneakers */}
      <Soft args={[0.38, 0.18, 0.33]} radius={0.085} position={[0, 0.56, -0.02]} color={look.pants} roughness={0.92} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.095, 0.56, 0]} to={[s * 0.105, 0.56, 0.42]} r={0.086} color={look.pants} roughness={0.92} />
          <Limb from={[s * 0.105, 0.54, 0.44]} to={[s * 0.11, 0.14, 0.48]} r={look.legWidth} color={look.pants} roughness={0.92} />
          <Soft args={[0.12, 0.085, 0.27]} radius={0.042} position={[s * 0.11, 0.06, 0.54]} color={look.shoes} roughness={0.75} />
          <Soft args={[0.13, 0.032, 0.29]} radius={0.014} position={[s * 0.11, 0.016, 0.55]} color="#d9d3c9" roughness={0.85} />
        </group>
      ))}

      <group ref={torso} position={[0, 0.6, 0]} rotation-x={0.08}>
        <mesh geometry={torsoGeometry} material={m.sweater} scale={[1.1, 1, 0.78]} />
        <mesh material={m.sweater} rotation-x={Math.PI / 2} scale={[1.1, 0.78, 1]}>
          <torusGeometry args={[0.172, 0.023, 10, 36]} />
        </mesh>
        <mesh material={m.sweater} position={[0, 0.5, 0.006]} rotation-x={Math.PI / 2} scale={[1, 0.85, 1]}>
          <torusGeometry args={[0.07, 0.023, 10, 28]} />
        </mesh>
        <mesh geometry={neckGeometry} material={m.skin} position={[0, 0.47, 0.012]} />

        <group ref={head} position={[0, 0.7, 0.02]}>
          <mesh geometry={headGeometry} material={m.skin} />
          <group ref={eyes}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.055, -0.03, 0.143]} rotation-y={s * 0.36}>
                <mesh material={m.eye} scale={[0.82, 1.3, 0.5]}>
                  <sphereGeometry args={[0.02, 20, 14]} />
                </mesh>
                <mesh material={m.glint} position={[s * 0.004, 0.012, 0.008]}>
                  <sphereGeometry args={[0.004, 8, 6]} />
                </mesh>
              </group>
            ))}
          </group>
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.skin} position={[s * 0.152, -0.03, 0]} scale={[0.45, 0.85, 0.7]}>
              <sphereGeometry args={[0.034, 16, 12]} />
            </mesh>
          ))}
          <Hair mat={m.hair} matLight={m.hairLight} />
        </group>

        <group position={[-0.2, 0.42, 0]}>
          <Arm side={-1} m={m} pivot={armL} color={look.sweater} />
        </group>
        <group position={[0.2, 0.42, 0]}>
          <Arm side={1} m={m} pivot={armR} color={look.sweater} />
        </group>
      </group>

      {(hover || peeking) && !active && (
        <Html position={[0, 1.75, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="tag tag--person">
            <b>{intro.title}</b>
            {intro.line}
          </div>
        </Html>
      )}
    </group>
  )
}

// Simple rounded bob with a side part: a crown for a clean hairline, one smooth volume around
// the head that frames the face (where it meets the face gives the outline), soft flipped ends,
// with the part swept to one side by tilting the crown. Smooth spheres only, no strands.
function BobHair({ mat, matLight }) {
  return (
    <group>
      {/* crown, tipped back so the forehead shows */}
      <mesh material={mat} position={[0.008, 0.03, -0.025]} rotation={[-0.55, 0, 0.22]} scale={[1.09, 1, 1.09]}>
        <sphereGeometry args={[HEAD_R, 56, 36]} />
      </mesh>
      {/* the bob's main volume, sitting just behind the face */}
      <mesh material={mat} position={[0, -0.015, -0.07]} scale={[0.19, 0.185, 0.175]}>
        <sphereGeometry args={[1, 56, 40]} />
      </mesh>
      {/* sides falling past the cheeks, framing the face and hiding the ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.138, -0.06, 0.005]} rotation-z={s * -0.06} scale={[0.058, 0.15, 0.125]}>
          <sphereGeometry args={[1, 40, 28]} />
        </mesh>
      ))}
      {/* rounded ends at chin length */}
      <mesh material={matLight} position={[0, -0.155, -0.09]} scale={[0.198, 0.058, 0.13]}>
        <sphereGeometry args={[1, 48, 24]} />
      </mesh>
    </group>
  )
}

export function Developer(props) {
  return <SeatedPerson look={DEV_LOOK} Hair={CurlyHair} intro={DEVELOPER} peekId="developer" {...props} />
}

export function Designer(props) {
  return <SeatedPerson look={DESIGN_LOOK} Hair={BobHair} intro={DESIGNER} peekId="designer" phase={2.3} {...props} />
}
