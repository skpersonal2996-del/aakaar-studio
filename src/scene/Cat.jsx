import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'

// The studio cat: Meshy's Puszek (CC0, by MrDavKot) with its quadruped walk, prepared by
// blender/prepare_cat.py. It strolls a loop around the desk — up the bookshelf side, past the arc lamp and the
// plants behind the desk, down the window side and across the rug in front — and now and then stops for a while.
const url = `${import.meta.env.BASE_URL}studio/cat.glb`
const LENGTH = 0.65 // nose to tail, metres: a little large for a real cat, in scale with the chibis
const SPEED = 0.32 // metres per second at a full walk; the walk cycle slows with it, so the paws don't slide
const PATH = new THREE.CatmullRomCurve3(
  [[-2.6, 1.2], [-2.7, -0.9], [-1.9, -2.5], [-0.6, -3.2], [1.0, -3.3], [2.5, -3.0], [3.5, -1.6], [3.6, 0.6], [2.2, 2.1], [0, 2.3], [-2.0, 2.0]]
    .map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
)
const LOOP = PATH.getLength()
const START = 0.502 // back right by the corner plant: it walks down the window side, then across the front

export function Cat() {
  const { scene, animations } = useGLTF(url, false, true)
  const ref = useRef()
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const walk = useRef({ at: START, pace: 0, rest: 0, next: 12 })
  const entered = useStore((s) => s.entered)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  // Scale to a cat's length and stand the paws on the floor. Meshy's armature carries a 0.01 scale, so the
  // posed skinned mesh is measured in the cat's own frame (Box3.setFromObject misreads skinned meshes).
  const fit = useMemo(() => {
    scene.updateMatrixWorld(true)
    const toCat = scene.matrixWorld.clone().invert()
    const box = new THREE.Box3()
    scene.traverse((o) => {
      if (!o.isSkinnedMesh) return
      o.skeleton.update() // bone matrices are only filled at the first render
      o.computeBoundingBox()
      box.union(o.boundingBox.clone().applyMatrix4(toCat.clone().multiply(o.matrixWorld)))
    })
    const size = box.getSize(new THREE.Vector3())
    const scale = LENGTH / Math.max(size.x, size.z)
    return { scale, lift: -box.min.y * scale }
  }, [scene])

  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = o.receiveShadow = true
      o.frustumCulled = false // the bind-pose box does not follow the walk
      o.material.roughness = Math.max(o.material.roughness, 0.8) // soft fur, no plastic sheen
    })
    mixer.clipAction(animations[0]).play()
    return () => mixer.stopAllAction()
  }, [scene, animations, mixer])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const w = walk.current
    if (entered) w.next -= dt
    if (w.rest > 0) w.rest -= dt
    else if (w.next <= 0) {
      w.rest = 2.5 + Math.random() * 3
      w.next = 12 + Math.random() * 14
    }
    const target = !entered || reduced.matches || w.rest > 0 ? 0 : 1 // waits at its start until the visitor steps in
    w.pace += (target - w.pace) * (1 - Math.exp(-dt * 4))
    mixer.timeScale = w.pace
    mixer.update(dt)
    w.at = (w.at + (SPEED * w.pace * dt) / LOOP) % 1
    const p = PATH.getPointAt(w.at)
    const t = PATH.getTangentAt(w.at)
    ref.current.position.set(p.x, fit.lift, p.z)
    ref.current.rotation.y = Math.atan2(t.x, t.z)
  })

  return (
    <group ref={ref}>
      <primitive object={scene} scale={fit.scale} />
    </group>
  )
}

useGLTF.preload(url, false, true)
