import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// Small primitives shared by every prop in the room.

export function Box({ args, color = '#222', roughness = 0.7, metalness = 0, map, emissive, children, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry args={args} />
      {children || <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={map} />}
    </mesh>
  )
}

export function Soft({ args, radius = 0.04, color = "#888", roughness = 0.9, metalness = 0, map, children, ...props }) {
  return (
    <RoundedBox args={args} radius={radius} smoothness={3} {...props}>
      {children || <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={map} />}
    </RoundedBox>
  )
}

export function Cyl({ args, color = '#222', roughness = 0.6, metalness = 0, children, ...props }) {
  return (
    <mesh {...props}>
      <cylinderGeometry args={args} />
      {children || <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />}
    </mesh>
  )
}

// Emissive strip that feeds the bloom pass. `color` is linear RGB and may exceed 1.
export function Glow({ args, color = [3, 1.9, 1], geometry = 'box', ...props }) {
  return (
    <mesh {...props} userData={{ noShadow: true }}>
      {geometry === 'box' ? <boxGeometry args={args} /> : <sphereGeometry args={args} />}
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

const UP = new THREE.Vector3(0, 1, 0)

// Capsule stretched between two points; used for limbs, stems and stands.
export function Limb({ from, to, r, color, roughness = 0.85 }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const d = b.clone().sub(a)
    const len = d.length()
    return {
      pos: a.add(b).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()),
      len,
    }
  }, [from.join(), to.join()])
  return (
    <mesh position={pos} quaternion={quat}>
      <capsuleGeometry args={[r, len, 4, 12]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  )
}
