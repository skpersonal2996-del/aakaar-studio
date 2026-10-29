import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { rng, shrink } from './textures'
import { Box } from './parts'
import { ROOM } from './views'

// A minimal window on the right wall looking out over the city: a sunset skyline in the warm
// theme, a starry night skyline in the night theme. The two views crossfade with the theme.

const SKIES = {
  sunset: {
    sky: [
      [0, '#3a2a5e'],
      [0.38, '#b85d86'],
      [0.62, '#f08a6a'],
      [0.8, '#ffc27a'],
      [1, '#ffe2a8'],
    ],
    layers: ['#b06a80', '#6e3d58', '#3a2236'],
    lit: ['#ffd9a0', '#ffb070'],
    litChance: [0.08, 0.12, 0.16],
  },
  night: {
    sky: [
      [0, '#05081f'],
      [0.5, '#121a4a'],
      [0.85, '#2c2361'],
      [1, '#4a2a66'],
    ],
    layers: ['#1d2150', '#121436', '#07081c'],
    lit: ['#ffd27a', '#ff8fc8', '#9fc2ff'],
    litChance: [0.22, 0.32, 0.4],
  },
}

function cityTexture(mode) {
  const W = 1024
  const H = 768
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')
  const s = SKIES[mode]
  const r = rng(mode === 'night' ? 71 : 37)

  // sky
  const g = x.createLinearGradient(0, 0, 0, H * 0.85)
  s.sky.forEach(([o, col]) => g.addColorStop(o, col))
  x.fillStyle = g
  x.fillRect(0, 0, W, H)

  if (mode === 'sunset') {
    // low sun with a soft halo
    const sun = x.createRadialGradient(W * 0.68, H * 0.62, 0, W * 0.68, H * 0.62, 260)
    sun.addColorStop(0, 'rgba(255,245,215,1)')
    sun.addColorStop(0.18, 'rgba(255,225,170,0.95)')
    sun.addColorStop(0.4, 'rgba(255,170,110,0.35)')
    sun.addColorStop(1, 'rgba(255,140,100,0)')
    x.fillStyle = sun
    x.fillRect(0, 0, W, H)
    // a few soft clouds
    x.fillStyle = 'rgba(255,200,170,0.35)'
    for (let i = 0; i < 6; i++) {
      x.beginPath()
      x.ellipse(r() * W, 80 + r() * 220, 80 + r() * 140, 8 + r() * 10, 0, 0, Math.PI * 2)
      x.fill()
    }
  } else {
    // stars and a moon
    for (let i = 0; i < 220; i++) {
      x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`
      const sz = r() < 0.9 ? 1.2 : 2.2
      x.fillRect(r() * W, r() * H * 0.55, sz, sz)
    }
    const moon = x.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.25, H * 0.2, 120)
    moon.addColorStop(0, 'rgba(255,248,235,1)')
    moon.addColorStop(0.28, 'rgba(255,240,225,1)')
    moon.addColorStop(0.32, 'rgba(200,190,255,0.35)')
    moon.addColorStop(1, 'rgba(160,150,255,0)')
    x.fillStyle = moon
    x.fillRect(0, 0, W, H)
  }

  // three layers of buildings, far to near
  s.layers.forEach((col, li) => {
    let bx = -20
    const base = H * (0.5 + li * 0.12)
    while (bx < W) {
      const bw = 40 + r() * 90
      const bh = (0.35 + r() * 0.65) * (H - base) * 0.9 + 40 + li * 30
      const top = H - bh
      x.fillStyle = col
      x.fillRect(bx, top, bw, bh)
      if (r() < 0.25) x.fillRect(bx + bw * 0.4, top - 30, 4, 30) // antenna
      // windows
      for (let wy = top + 12; wy < H - 8; wy += 16)
        for (let wx = bx + 8; wx < bx + bw - 10; wx += 13)
          if (r() < s.litChance[li]) {
            x.fillStyle = s.lit[Math.floor(r() * s.lit.length)]
            x.globalAlpha = 0.55 + li * 0.15
            x.fillRect(wx, wy, 6, 8)
            x.globalAlpha = 1
          }
      bx += bw + 2 + r() * 10
    }
  })

  // it's far-off scenery behind glass, so half resolution is plenty
  const t = new THREE.CanvasTexture(shrink(c, 0.5))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 2
  return t
}

const FRAME = '#141210'

export function CityWindow({ z = -2.0, y = 2.05, width = 2.4, height = 1.8 }) {
  const day = useMemo(() => cityTexture('sunset'), [])
  const night = useMemo(() => cityTexture('night'), [])
  const nightMat = useRef()
  const theme = useStore((s) => s.theme)

  // crossfade the outside view with the theme
  useFrame((_, dt) => {
    const m = nightMat.current
    const to = theme === 'night' ? 1 : 0
    m.opacity += (to - m.opacity) * (1 - Math.exp(-Math.min(dt, 0.1) * 3.5))
  })

  const x = ROOM.W / 2 - 0.02
  const t = 0.05 // frame thickness
  return (
    <group position={[x, y, z]} rotation-y={-Math.PI / 2}>
      {/* the view — unlit, so it reads as bright outdoor light */}
      <mesh position-z={-0.015} userData={{ noShadow: true }}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={day} color={[1.15, 1.1, 1.05]} toneMapped={false} />
      </mesh>
      <mesh position-z={-0.012} userData={{ noShadow: true }}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={nightMat} map={night} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* faint glass sheen */}
      <mesh position-z={0.004} userData={{ noShadow: true }}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.04} depthWrite={false} />
      </mesh>
      {/* slim black frame, one mullion and a transom */}
      <Box args={[width + t * 2, t, 0.08]} position={[0, height / 2 + t / 2, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      <Box args={[width + t * 2, t, 0.08]} position={[0, -height / 2 - t / 2, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      <Box args={[t, height, 0.08]} position={[-width / 2 - t / 2, 0, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      <Box args={[t, height, 0.08]} position={[width / 2 + t / 2, 0, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      <Box args={[0.025, height, 0.05]} position={[0, 0, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      <Box args={[width, 0.025, 0.05]} position={[0, height * 0.18, 0]} color={FRAME} metalness={0.4} roughness={0.5} />
      {/* deep sill */}
      <Box args={[width + 0.2, 0.04, 0.22]} position={[0, -height / 2 - t - 0.02, 0.08]} color="#2a1d14" roughness={0.6} />
    </group>
  )
}
