import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const base = import.meta.env.BASE_URL
const variants = new Map()

// Shared images, with a separate cached UV transform for each physical surface size.
export function useSurface(kind, repeat = [1, 1], rotation = 0) {
  const source = useTexture(['diff', 'normal', 'arm'].map(channel => `${base}materials/${kind}-${channel}.webp`))
  const key = `${kind}:${repeat.join(',')}:${rotation}`
  return useMemo(() => {
    if (!variants.has(key)) variants.set(key, source.map((image, i) => {
      const texture = image.clone()
      texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(...repeat)
      texture.center.set(.5, .5)
      texture.rotation = rotation
      texture.anisotropy = 8
      texture.needsUpdate = true
      return texture
    }))
    const [map, normalMap, arm] = variants.get(key)
    return { map, normalMap, roughnessMap: arm, aoMap: arm, metalnessMap: arm }
  }, [key, ...source])
}

export function SurfaceMaterial({kind, repeat, rotation = 0, normalStrength = .3, color = '#ffffff', roughness = 1, map, ...props}) {
  const surface = useSurface(kind, repeat, rotation)
  const scale = useMemo(() => new THREE.Vector2(normalStrength, normalStrength), [normalStrength])
  const textile = kind === 'linen'
  return <meshPhysicalMaterial {...surface} map={map || surface.map} color={color}
    roughness={roughness} metalness={0} aoMapIntensity={.3} normalScale={scale}
    clearcoat={textile ? 0 : .12} clearcoatRoughness={.5}
    sheen={textile ? .35 : 0} sheenRoughness={.9} sheenColor="#e4d3bb"
    {...props} />
}
