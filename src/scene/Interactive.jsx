import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { HOTSPOTS } from './views'
import { SECTIONS } from '../content'

// Pointer-up after a drag should not count as a click.
const isDrag = (e) => e.delta > 6

// Wraps an object so hovering highlights its marker and clicking focuses its section.
export function Clickable({ id, onSelect, children, ...props }) {
  const setHovered = useStore((s) => s.setHovered)
  const focus = useStore((s) => s.focus)
  const active = useStore((s) => s.active)
  const [hover, setHover] = useState(false)
  useCursor(hover && !active)
  return (
    <group
      {...props}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        if (id) setHovered(id)
      }}
      onPointerOut={() => {
        setHover(false)
        if (id) setHovered(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (active || isDrag(e)) return
        onSelect ? onSelect() : focus(id)
      }}>
      {children}
    </group>
  )
}

// Soft round glow used behind each marker.
const glowTexture = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

const ORANGE = [2.6, 0.75, 0.08] // saturated so tone mapping keeps it orange, bright enough to bloom

// A glowing "beacon": a warm dot inside a ring, with a ripple pulsing outwards — the familiar
// tap-here cue. It always faces the camera and grows when hovered.
function Hotspot({ id, position, size = 1 }) {
  const ref = useRef()
  const pulse = useRef()
  const core = useRef()
  const active = useStore((s) => s.active)
  const entered = useStore((s) => s.entered)
  const hovered = useStore((s) => s.hovered === id)
  const peek = useStore((s) => s.peek)
  const visible = entered && !active && !peek
  const phase = position[0] * 1.7

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = ref.current
    // slow, calm motion: a gentle bob, an unhurried ripple and a soft breathing core
    g.position.y = position[1] + Math.sin(t * 0.8 + phase) * 0.03
    // kept small; the farthest markers get only a slight boost so they stay readable
    const far = THREE.MathUtils.clamp(state.camera.position.distanceTo(g.position) / 7, 1, 1.2)
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, visible ? (hovered ? 1.15 : 0.85) * far * size : 0, 8, dt))
    const p = (t * 0.35 + phase) % 1
    pulse.current.scale.setScalar(1 + p * 1.1)
    pulse.current.material.opacity = (1 - p) * 0.7
    core.current.scale.setScalar(1 + Math.sin(t * 1.5 + phase) * 0.08 + (hovered ? 0.25 : 0))
  })

  return (
    <group>
      <Clickable id={id}>
        <Billboard ref={ref} position={position} scale={0}>
          {/* dark backing disc so the beacon stays readable on light, warm surfaces like the curtain */}
          <mesh renderOrder={1}>
            <circleGeometry args={[0.095, 48]} />
            <meshBasicMaterial color="#120905" transparent opacity={0.78} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={1}>
            <ringGeometry args={[0.095, 0.101, 48]} />
            <meshBasicMaterial color={[1.2, 0.95, 0.75]} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={2}>
            <planeGeometry args={[0.26, 0.26]} />
            <meshBasicMaterial map={glowTexture} color={[1.3, 0.38, 0.03]} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={3}>
            <ringGeometry args={[0.052, 0.064, 48]} />
            <meshBasicMaterial color={ORANGE} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={core} renderOrder={3}>
            <circleGeometry args={[0.026, 32]} />
            <meshBasicMaterial color={[3.2, 1.35, 0.3]} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={pulse} renderOrder={2}>
            <ringGeometry args={[0.062, 0.07, 48]} />
            <meshBasicMaterial color={ORANGE} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          {/* generous invisible hit area */}
          <mesh visible={false}>
            <sphereGeometry args={[0.2]} />
          </mesh>
        </Billboard>
      </Clickable>
      {visible && hovered && (
        <Html position={[position[0], position[1] + 0.24, position[2]]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="tag">
            <span>{SECTIONS[id].index}</span>
            {SECTIONS[id].label}
          </div>
        </Html>
      )}
    </group>
  )
}

export function Hotspots() {
  return Object.entries(HOTSPOTS).map(([id, [x, y, z, size = 1]]) => <Hotspot key={id} id={id} position={[x, y, z]} size={size} />)
}
