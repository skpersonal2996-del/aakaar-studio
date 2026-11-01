import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { WINDOW } from './views'

// The window on the right wall, looking out over the city: the same skyline at sunset in the warm
// theme and lit up at night in the night theme (painted for this project, see
// public/studio/window-sources.json). The two views crossfade with the theme.
//
// The view is drawn on the glass itself, but the shader traces each pixel's view ray to a virtual
// photo plane DEPTH metres behind the glass, so the city shifts with parallax as the camera orbits,
// whatever the wall geometry behind it. A faint Fresnel reflection of the room sits on top.

const base = import.meta.env.BASE_URL
const VIEWS = ['window-dusk.webp', 'window-night.webp'].map((f) => `${base}studio/${f}`)
useTexture.preload(VIEWS)

const DEPTH = 0.5 // metres from the glass to the virtual photo plane
const SPREAD = 1.6 // the photo plane is this much larger than the glass, so oblique views stay on it
// Linear multipliers before the scene's AgX tone mapping: bright outdoors that only just reaches
// the bloom threshold (1.0) in the sunset and the city lights, without clipping to white.
const BRIGHTNESS = { warm: 1.05, night: 1.15 }
const REFLECTION = { warm: new THREE.Color('#ffb98a'), night: new THREE.Color('#b88a9a') }
const FRAME = '#141210'

const vertexShader = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vCamera;
  void main() {
    vLocal = position;
    vCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz; // the camera in the window's space
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D dusk, night;
  uniform float mixNight, brightness, depth, reflection;
  uniform vec2 size, plane;
  uniform vec3 reflectColor;
  varying vec3 vLocal;
  varying vec3 vCamera;

  void main() {
    vec3 dir = normalize(vLocal - vCamera); // into the glass is -z
    float facing = max(-dir.z, 1e-3);

    // the city: where this view ray meets the photo plane behind the glass
    vec2 hit = vLocal.xy + dir.xy * (depth / facing);
    vec2 uv = clamp(hit / plane + 0.5, 0.0, 1.0);
    vec3 city = mix(texture2D(dusk, uv).rgb, texture2D(night, uv).rgb, mixNight) * brightness;

    // a little shade where the glass meets the frame
    vec2 edge = 0.5 * size - abs(vLocal.xy);
    city *= mix(0.78, 1.0, smoothstep(0.0, 0.09, min(edge.x, edge.y)));

    // glass: a faint reflection of the warm (or blue) room, stronger at grazing angles, and a soft
    // diagonal sheen
    float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);
    float sheen = smoothstep(0.35, 0.0, abs(dot(vLocal.xy / size, vec2(0.8, 0.6)) + 0.12)) * 0.05;
    vec3 glass = reflectColor * (fresnel * reflection + sheen);

    gl_FragColor = vec4(city * (1.0 - fresnel * 0.6) + glass, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function CityWindow({ frame = true }) {
  const { x, y, z, width, height } = WINDOW
  const [dusk, night] = useTexture(VIEWS)
  const theme = useStore((s) => s.theme)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const material = useMemo(() => {
    for (const t of [dusk, night]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
    }
    return new THREE.ShaderMaterial({
      uniforms: {
        dusk: { value: dusk },
        night: { value: night },
        mixNight: { value: 0 },
        brightness: { value: BRIGHTNESS.warm },
        depth: { value: DEPTH },
        reflection: { value: 0.3 },
        size: { value: new THREE.Vector2(width, height) },
        plane: { value: new THREE.Vector2(width * SPREAD, width * SPREAD * 0.75) }, // the photos are 4:3
        reflectColor: { value: REFLECTION.warm.clone() },
      },
      vertexShader,
      fragmentShader,
      toneMapped: false,
    })
  }, [dusk, night, width, height])

  // crossfade the outside view with the theme
  useFrame((_, dt) => {
    const u = material.uniforms
    const to = theme === 'night' ? 1 : 0
    const m = (u.mixNight.value = reduced ? to : u.mixNight.value + (to - u.mixNight.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 3.5)))
    u.brightness.value = THREE.MathUtils.lerp(BRIGHTNESS.warm, BRIGHTNESS.night, m)
    u.reflectColor.value.lerpColors(REFLECTION.warm, REFLECTION.night, m)
  })

  const t = 0.05 // frame thickness
  const bar = (args, position, key) => (
    <mesh key={key} position={position} castShadow={false} receiveShadow userData={{ noShadow: true }}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={FRAME} metalness={0.4} roughness={0.5} />
    </mesh>
  )

  return (
    <group position={[x, y, z]} rotation-y={-Math.PI / 2}>
      {/* the view and the glass, unlit so it reads as bright outdoor light */}
      <mesh material={material} userData={{ noShadow: true }}>
        <planeGeometry args={[width, height]} />
      </mesh>
      {frame && (
        <>
          {/* slim black frame, one mullion and a transom */}
          {bar([width + t * 2, t, 0.08], [0, height / 2 + t / 2, 0], 'top')}
          {bar([width + t * 2, t, 0.08], [0, -height / 2 - t / 2, 0], 'bottom')}
          {bar([t, height, 0.08], [-width / 2 - t / 2, 0, 0], 'left')}
          {bar([t, height, 0.08], [width / 2 + t / 2, 0, 0], 'right')}
          {bar([0.025, height, 0.05], [0, 0, 0], 'mullion')}
          {bar([width, 0.025, 0.05], [0, height * 0.18, 0], 'transom')}
          {/* deep sill */}
          <mesh position={[0, -height / 2 - t - 0.02, 0.08]} receiveShadow userData={{ noShadow: true }}>
            <boxGeometry args={[width + 0.2, 0.04, 0.22]} />
            <meshStandardMaterial color="#2a1d14" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}
