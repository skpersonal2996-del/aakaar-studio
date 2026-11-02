import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { night, roomLight } from './BakedRoom'

// The studio cat: Meshy's Puszek (CC0, by MrDavKot) with its quadruped walk and the jump and sit posed for it in
// blender/prepare_cat.py. It strolls a loop around the desk — up the bookshelf side, past the arc lamp and the
// plants behind the desk, down the window side and across the rug in front — and now and then stops for a while.
// It can also jump up onto the desk beside Shruti, sit while she strokes its head, and hop down again (switched off
// for now: see the 'path' phase below).
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
const nearest = (point) => {
  let best = 0, dist = Infinity
  for (let i = 0; i < 400; i++) {
    const d = PATH.getPointAt(i / 400).distanceToSquared(point)
    if (d < dist) [best, dist] = [i / 400, d]
  }
  return best
}

// The desk visit (the desk top is 0.68 m up, build_furniture.py DESK_TOP). From the rug in front it jumps onto the
// corner by Shruti's laptop, turns round to face the room and sits; later it hops down to the front and walks on.
const DESK_TOP = 0.68
const UP_FROM = new THREE.Vector3(1.48, 0, 1.95)
const SPOT = new THREE.Vector3(1.47, DESK_TOP, 1.04)
const DOWN_TO = new THREE.Vector3(1.2, 0, 2.05)
const AT_UP = nearest(UP_FROM) // where the loop passes the desk corner, heading left along the front
const AT_BACK = nearest(new THREE.Vector3(0.9, 0, 2.3)) // and where it picks the loop up again
const JUMP = 1.05, TAKEOFF = 0.36, LANDING = 0.8 // the Jump clip: off the ground and down again (seconds)
const TURN = 1.4 // turning round on the desk
const SIT = 11 // seconds sitting on the desk
const PET = [2.2, 8.6] // while Shruti strokes its head, within the sit
const crossed = (from, to, at) => (to >= from ? from < at && at <= to : at > from || at <= to)
function hop(from, to, t, arc, out) {
  const s = THREE.MathUtils.smoothstep(t, TAKEOFF, LANDING)
  out.lerpVectors(from, to, s)
  out.y += arc * 4 * s * (1 - s)
  return out
}
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z)
// Shared with Team.jsx: how much Shruti is reaching for the cat, and where its head is.
export const catPet = { weight: 0, target: new THREE.Vector3() }

// The room is lit by its baked lightmaps, the cat only by the few live lights meant for the characters, so it looked
// cool and flat against the warm floor. Instead it takes the baked light of the floor under its paws, read once
// along its path from both lightmaps (warm and night), exactly as the room surfaces are lit; a little of the live
// light is kept for its form, and a soft contact shadow sits under it. Only the brightness and a hint of the light's
// colour are taken, so the cat keeps its own grey and white fur.
const SAMPLES = 240
const FORM = 0.3 // share of the live lights, for shading across the body
const TINT = 0.25 // how much of the floor light's colour reaches the fur: the floor's own orange bounce would recolour the cat
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function pixels(texture, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(texture.image, 0, 0, size, size)
  return { data: ctx.getImageData(0, 0, size, size).data, size }
}
// The baked light (warm and night) of the surface under a point, or null over a seam or nothing.
function surfaceLight(maps, x, y, z) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y + 0.3, z), new THREE.Vector3(0, -1, 0), 0, 0.6)
  const info = new Map(roomLight.meshes.map((m) => [m.mesh, m]))
  const hit = ray.intersectObjects(roomLight.meshes.map((m) => m.mesh), false)[0]
  const m = hit && info.get(hit.object)
  const uv = m && (m.channel ? hit.uv1 : hit.uv)
  if (!uv) return null
  const lit = maps.map(({ data, size }, k) => {
    const px = Math.min(size - 1, Math.max(0, Math.floor(uv.x * size)))
    const py = Math.min(size - 1, Math.max(0, Math.floor(uv.y * size)))
    const j = (py * size + px) * 4, k2 = (m.scales || roomLight.scales)[k] * roomLight.exposure // each surface's own scale
    return new THREE.Color(toLinear(data[j] / 255) * k2, toLinear(data[j + 1] / 255) * k2, toLinear(data[j + 2] / 255) * k2)
  })
  return lit[0].r + lit[0].g + lit[0].b > 0.02 ? lit : null // a black texel is an atlas seam, not shade
}
function floorLight(maps) {
  let last = [new THREE.Color(0.4, 0.3, 0.25), new THREE.Color(0.2, 0.15, 0.2)]
  const raw = Array.from({ length: SAMPLES }, (_, i) => {
    const p = PATH.getPointAt(i / SAMPLES)
    return (last = surfaceLight(maps, p.x, 0, p.z) || last)
  })
  // Averaged along the path (about half a metre either way), so the fur never jumps between neighbouring texels.
  const R = 8
  return raw.map((_, i) => [0, 1].map((k) => {
    const c = new THREE.Color(0, 0, 0)
    for (let d = -R; d <= R; d++) c.add(raw[(i + d + SAMPLES) % SAMPLES][k])
    return c.multiplyScalar(1 / (2 * R + 1))
  }))
}

// Clicked, the cat stops, turns towards the visitor, looks up at the camera with her tail wagging and says meow,
// then walks on. The walk clip is her only animation, so the reaction is layered on top.
const REACT = 2.8 // seconds
const UP = new THREE.Vector3(0, 1, 0)
const ease = (x) => x * x * (3 - 2 * x)
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a)) // wrapped to -π..π
function turnBone(bone, q, parent) {
  // a rotation about a world axis, as a change of the bone's local rotation: local' = parent⁻¹ · q · parent · local
  bone.parent.getWorldQuaternion(parent)
  bone.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent))
}

// A soft dark disc under the cat, so its paws meet the floor.
function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

export function Cat() {
  const { scene, animations } = useGLTF(url, false, true)
  const ref = useRef()
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const walk = useRef({ at: START, pace: 0, rest: 0, next: 12 })
  // phase: 'path' (the loop), then for a desk visit 'approach', 'aim', 'up', 'turn', 'sit', 'down', 'rejoin'
  const visit = useRef({ phase: 'path', t: 0, next: 25, from: new THREE.Vector3(), yaw: 0 })
  if (import.meta.env.DEV) Object.assign(window, { __catVisit: visit.current, __catWalk: walk.current }) // for trying things: __catWalk.rest = 5
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

  const light = useRef(null)
  const lit = useMemo(() => ({ warm: new THREE.Color(0.4, 0.3, 0.25), night: new THREE.Color(0.2, 0.15, 0.2), cache: new Map() }), [])
  const materials = useRef([])
  const shadow = useMemo(() => shadowTexture(), [])
  const shadowMaterial = useRef()
  const tmp = useMemo(() => [new THREE.Color(), new THREE.Color()], [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const react = useRef({ t: REACT })
  const [hover, setHover] = useState(false)
  const [meow, setMeow] = useState(false)
  const active = useStore((s) => s.active)
  useCursor(hover && !active)
  const bones = useMemo(() => {
    const find = (name) => { let b = null; scene.traverse((o) => { if (o.isBone && o.name === name) b = o }); return b }
    return { head: find('head'), tail: ['tailstart', 'tail1', 'tail2', 'tail3'].map(find).filter(Boolean) }
  }, [scene])
  const q = useMemo(() => ({ q: new THREE.Quaternion(), p: new THREE.Quaternion() }), [])
  // The head and tail are turned on top of the walk; with the walk frozen the mixer stops rewriting them, so their
  // clip pose is kept and put back each frame, or the turns would pile up.
  const layered = useMemo(() => [bones.head, ...bones.tail].filter(Boolean).map((b) => [b, b.quaternion.clone()]), [bones])
  const clips = useRef({})

  useLayoutEffect(() => {
    materials.current = []
    scene.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = true
      o.frustumCulled = false // the bind-pose box does not follow the walk
      // Fur takes the floor's baked light as emission (the room's own shading) plus a little live light for form.
      o.material = new THREE.MeshLambertMaterial({ map: o.material.map, emissiveMap: o.material.map })
      materials.current.push(o.material)
    })
    const action = (name) => mixer.clipAction(animations.find((c) => c.name === name) || animations[0])
    clips.current = { walk: action('Walk'), jump: action('Jump'), sit: action('Sit') }
    clips.current.jump.setLoop(THREE.LoopOnce, 1).clampWhenFinished = true
    clips.current.walk.play()
    return () => mixer.stopAllAction()
  }, [scene, animations, mixer])

  // Fade from whatever is playing to one clip.
  const play = (name, fade = 0.25) => {
    const next = clips.current[name]
    for (const [key, a] of Object.entries(clips.current)) if (key !== name && a.isRunning()) a.fadeOut(fade)
    next.reset().setEffectiveWeight(1).fadeIn(fade).play()
  }

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    const w = walk.current
    const v = visit.current
    const r = react.current
    const { walk: walking } = clips.current
    const reacting = r.t < REACT
    if (reacting) r.t += dt
    v.t += dt
    let yaw = 0, airborne = 0
    if (v.phase === 'path') {
      if (entered) { w.next -= dt; v.next -= dt }
      if (w.rest > 0) w.rest -= dt
      else if (w.next <= 0) {
        w.rest = 2.5 + Math.random() * 3
        w.next = 12 + Math.random() * 14
      }
      const target = !entered || reduced.matches || w.rest > 0 || reacting ? 0 : 1 // waits at its start until the visitor steps in
      w.pace += (target - w.pace) * (1 - Math.exp(-dt * 4))
      const before = w.at
      w.at = (w.at + (SPEED * w.pace * dt) / LOOP) % 1
      pos.copy(PATH.getPointAt(w.at))
      const t = PATH.getTangentAt(w.at)
      yaw = Math.atan2(t.x, t.z)
      // The desk visit is switched off for now; uncomment to let it jump up beside Shruti again.
      // if (v.next <= 0 && !reacting && !reduced.matches && crossed(before, w.at, AT_UP)) Object.assign(v, { phase: 'approach', t: 0 })
    } else if (v.phase === 'approach' || v.phase === 'rejoin') {
      // a few steps off the loop to the foot of the desk, or back onto it
      const goal = v.phase === 'approach' ? UP_FROM : PATH.getPointAt(AT_BACK)
      const step = SPEED * dt, left = goal.clone().sub(pos).setY(0)
      yaw = v.yaw = Math.atan2(left.x, left.z)
      if (left.length() <= step) {
        pos.copy(goal)
        if (v.phase === 'approach') Object.assign(v, { phase: 'aim', t: 0, from: new THREE.Vector3().copy(pos) })
        else { Object.assign(v, { phase: 'path', next: 50 + Math.random() * 40 }); w.at = AT_BACK }
      } else pos.add(left.setLength(step))
      w.pace += (1 - w.pace) * (1 - Math.exp(-dt * 4))
    } else if (v.phase === 'aim') {
      // stop, and turn to face the desk top
      w.pace += (0 - w.pace) * (1 - Math.exp(-dt * 6))
      const k = ease(Math.min(v.t / 0.6, 1))
      yaw = v.yaw + angle(yawTo(UP_FROM, SPOT) - v.yaw) * k
      if (v.t > 0.8) { Object.assign(v, { phase: 'up', t: 0, yaw: yawTo(UP_FROM, SPOT) }); play('jump', 0.2) }
    } else if (v.phase === 'up' || v.phase === 'down') {
      const [from, to] = v.phase === 'up' ? [UP_FROM, SPOT] : [SPOT, DOWN_TO]
      hop(from, to, v.t, v.phase === 'up' ? 0.16 : 0.06, pos)
      yaw = v.yaw
      airborne = v.t > TAKEOFF && v.t < LANDING ? 1 : 0
      if (v.t >= JUMP) {
        if (v.phase === 'up') { Object.assign(v, { phase: 'turn', t: 0 }); play('walk', 0.3); w.pace = 0.5 }
        else { Object.assign(v, { phase: 'rejoin', t: 0 }); play('walk', 0.3) }
      }
    } else if (v.phase === 'turn') {
      // round to face the room, by Shruti's side
      w.pace += (0.45 - w.pace) * (1 - Math.exp(-dt * 6))
      yaw = v.yaw - Math.PI * ease(Math.min(v.t / TURN, 1))
      pos.copy(SPOT)
      if (v.t >= TURN) { Object.assign(v, { phase: 'sit', t: 0, yaw }); play('sit', 0.6) }
    } else if (v.phase === 'sit') {
      yaw = v.yaw
      pos.copy(SPOT)
      if (v.t >= SIT) { Object.assign(v, { phase: 'down', t: 0, yaw: yawTo(SPOT, DOWN_TO) }); play('jump', 0.35) }
    }
    if (v.phase === 'sit') yaw = v.yaw + angle(yawTo(SPOT, DOWN_TO) - v.yaw) * ease(THREE.MathUtils.clamp((v.t - SIT + 0.6) / 0.6, 0, 1))
    walking.timeScale = w.pace
    for (const [b, clean] of layered) b.quaternion.copy(clean)
    mixer.update(dt)
    for (const [b, clean] of layered) clean.copy(b.quaternion)

    // light: from the samples along the loop, or from the surface under it off the loop; eased so it never jumps
    if (!light.current && roomLight.meshes.length && roomLight.warm?.image) {
      const maps = [pixels(roomLight.warm), pixels(roomLight.night)]
      light.current = { maps, path: floorLight(maps) }
    }
    if (light.current) {
      const [warm, nite] = tmp
      if (v.phase === 'path') {
        const f = w.at * SAMPLES, i = Math.floor(f) % SAMPLES, j = (i + 1) % SAMPLES, u = f - Math.floor(f)
        warm.lerpColors(light.current.path[i][0], light.current.path[j][0], u)
        nite.lerpColors(light.current.path[i][1], light.current.path[j][1], u)
      } else {
        const key = `${Math.round(pos.x * 10)},${pos.y > 0.3 ? 1 : 0},${Math.round(pos.z * 10)}`
        if (!lit.cache.has(key)) lit.cache.set(key, surfaceLight(light.current.maps, pos.x, pos.y > 0.3 ? DESK_TOP : 0, pos.z))
        const here = lit.cache.get(key)
        if (here) { warm.copy(here[0]); nite.copy(here[1]) } else { warm.copy(lit.warm); nite.copy(lit.night) }
      }
      const k = 1 - Math.exp(-dt * 4)
      lit.warm.lerp(warm, k); lit.night.lerp(nite, k)
      warm.copy(lit.warm).lerp(lit.night, night.value)
      const level = warm.r * 0.2126 + warm.g * 0.7152 + warm.b * 0.0722
      nite.setScalar(level).lerp(warm.multiplyScalar(level / Math.max(warm.r, warm.g, warm.b, 1e-4) * 1.3), TINT)
      warm.copy(nite)
      for (const m of materials.current) {
        m.emissive.copy(warm).multiplyScalar(1 - FORM)
        m.color.copy(warm).multiplyScalar(FORM * 2)
      }
    }

    if (reacting && v.phase === 'path' && !reduced.matches) {
      const heading = yaw
      const k = ease(Math.min(r.t / 0.35, 1)) * ease(Math.min((REACT - r.t) / 0.5, 1)) // in and out
      const toCamera = angle(Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z) - heading)
      yaw = heading + toCamera * 0.55 * k                 // the body turns part of the way...
      const look = THREE.MathUtils.clamp(toCamera * 0.45, -0.9, 0.9) * k // ...the head the rest
      ref.current.updateMatrixWorld(true)
      if (bones.head) turnBone(bones.head, q.q.setFromAxisAngle(UP, look), q.p)
      bones.tail.forEach((b, i) => turnBone(b, q.q.setFromAxisAngle(UP, Math.sin(r.t * 11 - i * 0.7) * 0.28 * k), q.p))
    } else if (v.phase === 'path' && !reduced.matches && w.pace < 0.95) {
      // Stopped for a while, the walk is frozen; the tail keeps swishing, slowly, the tip more than the base.
      const idle = 1 - w.pace, t = clock.elapsedTime
      ref.current.updateMatrixWorld(true)
      bones.tail.forEach((b, i) => turnBone(b, q.q.setFromAxisAngle(UP, Math.sin(t * 1.7 - i * 0.6) * (0.08 + 0.05 * i) * idle), q.p))
    }
    const talking = reacting && r.t > 0.4 && r.t < REACT - 0.5
    if (talking !== meow) setMeow(talking)
    ref.current.position.set(pos.x, pos.y + fit.lift, pos.z)
    ref.current.rotation.y = yaw
    if (shadowMaterial.current) shadowMaterial.current.opacity += ((airborne ? 0 : 1) - shadowMaterial.current.opacity) * (1 - Math.exp(-dt * 12))

    // Shruti strokes its head while it sits by her (Team.jsx reads this).
    const petting = v.phase === 'sit' && v.t > PET[0] && v.t < PET[1] ? 1 : 0
    catPet.weight += (petting - catPet.weight) * (1 - Math.exp(-dt * 3))
    if (bones.head && catPet.weight > 0.001) {
      ref.current.updateMatrixWorld(true)
      bones.head.getWorldPosition(catPet.target)
    }
  })

  return (
    <group ref={ref}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true) }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (!active && e.delta <= 6 && react.current.t >= REACT && visit.current.phase === 'path') react.current.t = 0
      }}>
      <primitive object={scene} scale={fit.scale} />
      {/* an easy click target around the whole cat */}
      <mesh visible={false} position-y={0.2 - fit.lift}>
        <boxGeometry args={[LENGTH * 0.5, 0.42, LENGTH * 1.05]} />
      </mesh>
      {meow && (
        <Html position-y={0.55 - fit.lift} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="tag">meow!</div>
        </Html>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004 - fit.lift} scale={[LENGTH * 0.55, LENGTH * 1.05, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={shadowMaterial} map={shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

useGLTF.preload(url, false, true)
