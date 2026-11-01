import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { Clickable } from './Interactive'
import { HIT_BOXES } from './views'

const base = import.meta.env.BASE_URL
const url = (file) => `${base}studio/${file}`
const small = window.matchMedia('(max-width: 820px)').matches
const size = small ? '-2k' : ''
// Blender's view exposure (+0.8 EV) is applied here, so the room matches the look-dev renders.
const EXPOSURE = 2 ** 0.8
const GLOW = 0.15 * EXPOSURE // Blender emission strength → web HDR colour that blooms

// Shared by every lit room material: how far the night lightmap is blended in.
const night = { value: 0 }
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
    const { web_emissive, web_light_scale = 1, web_light_scale_night = 1, web_cutout, web_gloss, web_tint } = old.userData
    const scales = [web_light_scale, web_light_scale_night]
    if (web_emissive) {
      o.material = new THREE.MeshBasicMaterial({ map: old.emissiveMap, toneMapped: false })
      if (old.emissiveMap) o.material.color.setScalar(1.15)
      else o.material.color.setRGB(...web_emissive).multiplyScalar(GLOW)
    } else if (web_gloss) {
      // The room is exported without normals; reflections need flat ones (shared corners would tilt the top).
      o.geometry = o.geometry.toNonIndexed()
      o.geometry.computeVertexNormals()
      o.material = glossyMaterial({ map: old.map, warm: second.warm, nightMap: second.night, scales, tint: web_tint })
    } else if (o.name.startsWith('Textured')) {
      if (old.map) old.map.anisotropy = 8
      o.material = bakedMaterial({ map: old.map, warm: second.warm, nightMap: second.night, scales, cutout: web_cutout })
      if (!old.map) o.material.color.copy(old.color) // plain parts of a textured prop
    } else {
      o.material = bakedMaterial({ map: albedo, warm, nightMap, scales })
    }
    old.dispose()
    o.matrixAutoUpdate = false
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

  useFrame((_, dt) => {
    const to = theme === 'night' ? 1 : 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    night.value = reduced ? to : night.value + (to - night.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 3.5))
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
