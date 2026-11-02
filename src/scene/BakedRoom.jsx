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
function convert(scene, albedo, warm, nightMap) {
  if (scene.userData.baked) return
  const second = { warm: warm.clone(), night: nightMap.clone() }
  second.warm.channel = second.night.channel = 1
  scene.traverse((o) => {
    if (!o.isMesh) return
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
      roomLight.meshes.push({ mesh: o, channel: 1, scales }) // the desk top, for the cat when she sits on it
    } else if (o.name.startsWith('Textured')) {
      if (old.map) old.map.anisotropy = 8
      o.material = bakedMaterial({ map: old.map, warm: second.warm, nightMap: second.night, scales, cutout: web_cutout })
      roomLight.meshes.push({ mesh: o, channel: 1, scales }) // the rugs, among the textured props
      if (!old.map) o.material.color.copy(old.color) // plain parts of a textured prop
    } else {
      o.material = bakedMaterial({ map: albedo, warm, nightMap, scales })
      Object.assign(roomLight, { warm, night: nightMap, scales })
      roomLight.meshes.push({ mesh: o, channel: 0, scales })
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
