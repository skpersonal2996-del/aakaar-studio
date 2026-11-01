import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { Clickable } from './Interactive'
import { flicker } from './flicker'
import { HIT_BOXES, ROOM_ID } from './views'

const base = import.meta.env.BASE_URL
const url = (file) => `${base}studio/${ROOM_ID}/${file}` // each mood's bake in its own folder
const small = window.matchMedia('(max-width: 820px)').matches
const size = small ? '-2k' : ''
// Blender's view exposure (lookdev_spacious.py) is applied here, so the room matches the renders;
// the cream room is shown 10 % darker than its render.
const EXPOSURE = ROOM_ID === 'spacious-cream' ? 2 ** 0.8 * 0.9 : 2 ** 1.0
const WARM_LEVEL = ROOM_ID === 'spacious-cream' ? 0.88 : 1 // the cream room's warm theme, a touch softer than the bake
const GLOW = 0.15 * EXPOSURE // Blender emission strength → web HDR colour that blooms

// Shared by every lit room material: how far the night lightmap is blended in.
export const night = { value: 0 }
// The merged room mesh and its two lightmaps, so live props (the cat) can take the light of the floor they stand on.
export const roomLight = { meshes: [], warm: null, night: null, scales: [1, 1], exposure: EXPOSURE }
// Lamps and LEDs: their warm and night glow colours, crossfaded with the lightmaps.
const glows = []
// Candle flames flicker and plant leaves sway (their vertices carry a '_wind' weight from the bake).
const flames = []
const wind = { value: 0 }
const NIGHT_UNIFORMS = 'uniform sampler2D nightMap;\nuniform float nightMix, warmScale, nightScale;\n'
const MIX_LIGHTMAPS = [
  'vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );',
  'vec4 lightMapTexel = mix( texture2D( lightMap, vLightMapUv ) * warmScale, texture2D( nightMap, vLightMapUv ) * nightScale, nightMix );',
]
const lightUniforms = (nightMap, scales) => ({
  nightMap: { value: nightMap },
  nightMix: night,
  warmScale: { value: scales[0] },
  nightScale: { value: scales[1] },
})

// Unlit material lit by the two baked lightmaps (warm and night), blended on the GPU. Each lightmap
// was scaled to fit 8 bits in Blender; the scales come back through the glTF material extras.
function bakedMaterial({ map, warm, nightMap, scales, cutout }) {
  const material = new THREE.MeshBasicMaterial({ map, lightMap: warm, lightMapIntensity: Math.PI * EXPOSURE })
  if (cutout) Object.assign(material, { alphaTest: 0.5, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lightUniforms(nightMap, scales))
    shader.fragmentShader = NIGHT_UNIFORMS + shader.fragmentShader.replace(...MIX_LIGHTMAPS)
  }
  return material
}

// Leaves move with the vertex weight the bake stored: a slow sway plus a quick flutter, out of step
// from plant to plant. Everything else in the mesh has a weight of 0 and stays put.
function sway(material) {
  const compile = material.onBeforeCompile
  material.onBeforeCompile = (shader) => {
    compile(shader)
    shader.uniforms.windTime = wind
    shader.vertexShader = 'attribute float _wind;\nuniform float windTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float phase = dot(position.xz, vec2(1.7, 2.3));
      transformed.xz += _wind * (0.03 * vec2(sin(windTime * 0.9 + phase), cos(windTime * 0.7 + phase * 1.3))
        + 0.006 * sin(windTime * 3.1 + dot(position, vec3(9.0, 7.0, 11.0))));`,
    )
  }
  material.customProgramCacheKey = () => 'sway'
}

// The lacquered walnut desk top: its own grain texture, the same baked light, and a clear coat. Diffuse light
// comes only from the lightmaps, as on every other surface; the live lights and the room's environment map
// (Studio.jsx) add just the highlights and reflections, boosted past the scene's dim environment intensity.
const REFLECTION = 2.2
function glossyMaterial({ map, warm, nightMap, scales, tint }) {
  map.anisotropy = 8
  const material = new THREE.MeshPhysicalMaterial({
    // darker than the tint alone: in Blender the lacquer takes light from the wood beneath it
    map, color: new THREE.Color().setRGB(...tint).multiplyScalar(0.55), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05,
    lightMap: warm, lightMapIntensity: Math.PI * EXPOSURE,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lightUniforms(nightMap, scales))
    const maps = 'irradiance = vec3( 0.0 ); // drop the live ambient and hemisphere fill: the lightmap has it\n' +
      THREE.ShaderChunk.lights_fragment_maps
      .replace(...MIX_LIGHTMAPS)
      .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '') // no extra diffuse from the environment
      .replaceAll('Radiance += getIBLRadiance(', `Radiance += ${REFLECTION.toFixed(2)} * getIBLRadiance(`)
      .replace('radiance += getIBLRadiance(', `radiance += ${REFLECTION.toFixed(2)} * getIBLRadiance(`)
    shader.fragmentShader = NIGHT_UNIFORMS + shader.fragmentShader
      .replace('#include <lights_fragment_maps>', maps)
      .replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
        'vec3 totalDiffuse = reflectedLight.indirectDiffuse;') // the live lights only add highlights
  }
  return material
}

// Swaps the exported materials for unlit ones once per loaded scene. 'Room · baked' is one merged
// mesh with an albedo atlas on the lightmap UVs; 'Textured · props' keeps each photo, book cover and
// CC0 prop texture on uv0 with the lightmap on uv1; the glossy desk top does the same with its walnut
// grain; lamps, LEDs and screens become HDR glow colours.
// TEMPORARY, until the rooms are re-baked: the first site's desk pot and its black succulent are removed in
// blender/assemble_cozy_room.py, but the current bakes still contain them (and the candles that stood in the pot).
// Their triangles are cut out here; delete this once the rooms are re-baked, or it would cut the new desk candles.
const CUT = new THREE.Box3(new THREE.Vector3(-0.01, 0.75, 0.62), new THREE.Vector3(0.39, 1.15, 1.06))
function cut(o) {
  const g = o.geometry, pos = g.attributes.position, v = new THREE.Vector3()
  const inside = (i) => CUT.containsPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld))
  o.updateWorldMatrix(true, false)
  if (!g.index) return inside(0) && (o.visible = false)
  const index = g.index.array, keep = []
  for (let i = 0; i < index.length; i += 3) {
    if (!(inside(index[i]) && inside(index[i + 1]) && inside(index[i + 2]))) keep.push(index[i], index[i + 1], index[i + 2])
  }
  if (keep.length < index.length) g.setIndex(keep)
}

// TEMPORARY as well: the pot's shadow is baked into the desk top's light as a dark ring. Where the desk top maps into
// the lightmaps is found from one of its upward-facing triangles, and the ring's texels are filled in smoothly from
// the light around them (a few hundred relaxation passes over a small patch), in both lightmaps.
const RING = { x: 0.2, z: 0.85, radius: 0.22 }
function eraseRing(desk, textures) {
  const g = desk.geometry, pos = g.attributes.position, uv = g.attributes.uv1
  if (!uv) return
  desk.updateWorldMatrix(true, false)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let map = null
  for (let i = 0; i < pos.count && !map; i += 3) {
    a.fromBufferAttribute(pos, i).applyMatrix4(desk.matrixWorld)
    b.fromBufferAttribute(pos, i + 1).applyMatrix4(desk.matrixWorld)
    c.fromBufferAttribute(pos, i + 2).applyMatrix4(desk.matrixWorld)
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
    if (Math.abs(n.y) < 0.95 || a.y < 0.755) continue // the top surface (its underside has its own patch)
    // affine map from world (x, z) to uv through the corners of the top triangle under the ring's centre
    const [x0, z0, x1, z1, x2, z2] = [a.x, a.z, b.x, b.z, c.x, c.z]
    const det = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)
    const s0 = ((RING.x - x0) * (z2 - z0) - (x2 - x0) * (RING.z - z0)) / det
    const t0 = ((x1 - x0) * (RING.z - z0) - (RING.x - x0) * (z1 - z0)) / det
    if (s0 < 0 || t0 < 0 || s0 + t0 > 1) continue
    const u0 = uv.getX(i), v0 = uv.getY(i), du1 = uv.getX(i + 1) - u0, dv1 = uv.getY(i + 1) - v0
    const du2 = uv.getX(i + 2) - u0, dv2 = uv.getY(i + 2) - v0
    map = (x, z) => {
      const s = ((x - x0) * (z2 - z0) - (x2 - x0) * (z - z0)) / det, t = ((x1 - x0) * (z - z0) - (x - x0) * (z1 - z0)) / det
      return [u0 + s * du1 + t * du2, v0 + s * dv1 + t * dv2]
    }
  }
  if (!map) return
  const [cu, cv] = map(RING.x, RING.z), [eu, ev] = map(RING.x + RING.radius, RING.z), [fu, fv] = map(RING.x, RING.z + RING.radius)
  const done = new Map() // the clones share their originals' images: patch each image once
  for (const texture of textures) {
    const image = texture.image, size = image.width
    if (done.has(image)) { texture.image = done.get(image); texture.needsUpdate = true; continue }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0)
    const r = Math.ceil(Math.max(Math.hypot(eu - cu, ev - cv), Math.hypot(fu - cu, fv - cv)) * size) + 2
    const x0 = Math.max(0, Math.floor(cu * size) - r - 2), y0 = Math.max(0, Math.floor(cv * size) - r - 2), w = 2 * r + 5
    const patch = ctx.getImageData(x0, y0, w, w), d = patch.data
    const inside = (x, y) => Math.hypot(x0 + x + 0.5 - cu * size, y0 + y + 0.5 - cv * size) < r - 1
    for (let pass = 0; pass < 400; pass++) {
      for (let y = 1; y < w - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!inside(x, y)) continue
        const i = (y * w + x) * 4
        for (let k = 0; k < 3; k++) d[i + k] = (d[i - 4 + k] + d[i + 4 + k] + d[i - w * 4 + k] + d[i + w * 4 + k]) / 4
      }
    }
    ctx.putImageData(patch, x0, y0)
    done.set(image, canvas)
    texture.image = canvas
    texture.needsUpdate = true
  }
}

function convert(scene, albedo, warm, nightMap) {
  if (scene.userData.baked) return
  const second = { warm: warm.clone(), night: nightMap.clone() }
  second.warm.channel = second.night.channel = 1
  scene.traverse((o) => {
    if (!o.isMesh) return
    cut(o)
    const old = o.material
    const { web_emissive, web_emissive_night, web_light_scale = 1, web_light_scale_night = 1, web_cutout, web_gloss, web_tint } = old.userData
    const scales = [web_light_scale * WARM_LEVEL, web_light_scale_night]
    if (web_emissive) {
      o.material = new THREE.MeshBasicMaterial({ map: old.emissiveMap, toneMapped: false })
      if (old.emissiveMap) o.material.color.setScalar(1.15)
      else {
        o.material.color.setRGB(...web_emissive).multiplyScalar(GLOW)
        const warmColour = o.material.color.clone()
        const nightColour = new THREE.Color().setRGB(...(web_emissive_night || web_emissive)).multiplyScalar(GLOW)
        const glow = { material: o.material, warm: warmColour, night: nightColour }
        glows.push(glow)
        if (o.name.includes('flame')) {
          // Flicker about the flame's base: move the origin there. The node's own scale and offset
          // decode the quantized positions (meshopt), so they are kept and the flicker multiplies them.
          o.geometry.computeBoundingBox()
          const { min, max } = o.geometry.boundingBox
          const foot = new THREE.Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2)
          o.geometry.translate(-foot.x, -foot.y, -foot.z)
          o.position.add(foot.multiply(o.scale).applyQuaternion(o.quaternion))
          flames.push({ mesh: o, glow, scale: o.scale.clone(), seed: flames.length * 1.7 })
        }
      }
    } else if (web_gloss) {
      // The room is exported without normals; reflections need flat ones (shared corners would tilt the top).
      o.geometry = o.geometry.toNonIndexed()
      o.geometry.computeVertexNormals()
      o.material = glossyMaterial({ map: old.map, warm: second.warm, nightMap: second.night, scales, tint: web_tint })
      eraseRing(o, [warm, nightMap, second.warm, second.night])
    } else if (o.name.startsWith('Textured')) {
      if (old.map) old.map.anisotropy = 8
      o.material = bakedMaterial({ map: old.map, warm: second.warm, nightMap: second.night, scales, cutout: web_cutout })
      roomLight.meshes.push({ mesh: o, channel: 1 }) // the rugs, among the textured props
      if (!old.map) o.material.color.copy(old.color) // plain parts of a textured prop
    } else {
      o.material = bakedMaterial({ map: albedo, warm, nightMap, scales })
      Object.assign(roomLight, { warm, night: nightMap, scales })
      roomLight.meshes.push({ mesh: o, channel: 0 })
    }
    if (o.geometry.attributes._wind) sway(o.material)
    old.dispose()
    o.matrixAutoUpdate = flames.some((f) => f.mesh === o)
    o.updateMatrix()
  })
  scene.userData.baked = true
}

function useRoom() {
  const { scene } = useGLTF(url('room.glb'), false, true)
  const [albedo, warm, nightMap] = useTexture(
    ['room-albedo', 'room-light-warm', 'room-light-night'].map((name) => url(`${name}${size}.webp`)),
  )
  return useMemo(() => {
    for (const t of [albedo, warm, nightMap]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.flipY = false
      t.anisotropy = 8
    }
    convert(scene, albedo, warm, nightMap)
    return scene
  }, [scene, albedo, warm, nightMap])
}

export function BakedRoom() {
  const scene = useRoom()
  const theme = useStore((s) => s.theme)

  useFrame(({ clock }, dt) => {
    const to = theme === 'night' ? 1 : 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    night.value = reduced ? to : night.value + (to - night.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 3.5))
    for (const g of glows) g.material.color.lerpColors(g.warm, g.night, night.value)
    if (reduced) return
    const t = clock.elapsedTime
    wind.value = t
    for (const { mesh, glow, scale, seed } of flames) {
      const f = flicker(t, seed)
      glow.material.color.multiplyScalar(1 + 0.25 * f)
      mesh.scale.set(scale.x * (1 - 0.08 * f), scale.y * (1 + 0.22 * f), scale.z * (1 - 0.08 * f))
      mesh.rotation.z = 0.06 * Math.sin(t * 2.3 + seed)
    }
  })

  return (
    <group>
      <primitive object={scene} />
      {Object.entries(HIT_BOXES).map(([id, [position, size]]) => (
        <Clickable key={id} id={id} position={position}>
          <mesh>
            <boxGeometry args={size} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </Clickable>
      ))}
    </group>
  )
}

// A copy of the lit room, rendered once into the characters' environment map so their
// reflections and soft ambient light come from the same bake.
export function RoomReflection(props) {
  const scene = useRoom()
  const copy = useMemo(() => scene.clone(), [scene])
  return <primitive object={copy} {...props} />
}

useGLTF.preload(url('room.glb'), false, true)
