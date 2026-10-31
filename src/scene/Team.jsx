import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { DESIGNER, DEVELOPER } from '../content'
import { useStore } from '../store'

const base = import.meta.env.BASE_URL
const inspection = import.meta.env.DEV ? new URLSearchParams(location.search).get('inspect') : null
const models = {
  developer: inspection==='source' ? '/blender/generated/vinay-typing.glb' : `${base}characters/vinay-typing.glb`,
  designer: inspection==='source' ? '/blender/generated/shruti-typing.glb' : `${base}characters/shruti-typing.glb`,
}

// The restored Meshy faces and PBR textures are preserved. The seated pose and
// eight-second typing loop are skeletal animation authored and baked in Blender.
function SeatedPerson({ model, intro, peekId, phase = 0, ...props }) {
  const { scene, animations } = useGLTF(model, false, true)
  const actor = useMemo(() => clone(scene), [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(actor), [actor])
  const motion = useRef(null)
  const [hover, setHover] = useState(false)
  const active = useStore(s => s.active)
  const peeking = useStore(s => s.peek === peekId)
  const setPeek = useStore(s => s.setPeek)
  useCursor(hover && !active && !peeking)

  useLayoutEffect(() => {
    motion.current = window.matchMedia('(prefers-reduced-motion: reduce)')
    actor.traverse(object => {
      if (object.isMesh) {
        if(inspection==='unlit') object.material=new THREE.MeshBasicMaterial({map:object.material.map,color:object.material.color})
        if(inspection==='nonormal') {object.material=object.material.clone();object.material.normalMap=null}
        if(inspection==='noshadow') object.userData.noShadow=true
        if(inspection==='nomip') for(const slot of ['map','normalMap','roughnessMap','metalnessMap']) {
          const texture=object.material[slot]
          if(texture){texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true}
        }
        object.castShadow = true
        object.receiveShadow = true
        // A bind-pose bounding box cannot represent a seated skinned character.
        object.frustumCulled = false
      }
    })
    const action = mixer.clipAction(animations[0])
    action.setLoop(THREE.LoopRepeat, Infinity).reset().play()
    action.time = phase
    // Apply a seated frame before the first paint, including reduced motion.
    mixer.update(0)
    actor.updateMatrixWorld(true)
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(actor)
    }
  }, [actor, animations, mixer, phase])

  useFrame((_, delta) => {
    if (!motion.current?.matches) mixer.update(Math.min(delta, .05))
  })

  return <group {...props} userData={{studioActor:peekId}}
    onPointerOver={event => { event.stopPropagation(); setHover(true) }}
    onPointerOut={() => setHover(false)}
    onClick={event => {
      event.stopPropagation()
      if (!active && event.delta <= 6) setPeek(peekId)
    }}>
    <primitive object={actor} dispose={null} />
    {(hover || peeking) && !active && <Html position={[0, 1.7, 0]} center
      zIndexRange={[20, 0]} style={{pointerEvents:'none'}}>
      <div className="tag tag--person"><b>{intro.title}</b>{intro.line}</div>
    </Html>}
  </group>
}

export function Developer(props) {
  return <SeatedPerson model={models.developer} intro={DEVELOPER} peekId="developer" {...props} />
}
export function Designer(props) {
  return <SeatedPerson model={models.designer} intro={DESIGNER} peekId="designer" phase={2.3} {...props} />
}
