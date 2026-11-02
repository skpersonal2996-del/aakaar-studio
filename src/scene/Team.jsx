import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { DESIGNER, DEVELOPER, PROJECTS } from '../content'
import { useStore } from '../store'
import { SEATS } from './views'
import { mapScreen, projectTexture, screenTexture } from './screens'

const base = import.meta.env.BASE_URL
// Where each face's cheeks are, in the model's bind pose as Blender sees it (found from the face renders: below and
// outside the painted eyes), with the blush's radius and the mesh's bounds in the same units. The web files store
// positions quantized (optimize-characters.mjs), so the cheeks are mapped across through the two bounding boxes.
const BLUSH = {
  vinay: { cheeks: [[-6.82, 130.13, 11.91], [6.6, 130.13, 12.08]], radius: 3.1, bounds: [[-49.985, 0, -20.961], [49.985, 160, 20.961]] },
  shruti: { cheeks: [[-6.88, 132.27, 15.62], [6.66, 132.27, 15.81]], radius: 3.13, bounds: [[-58.429, 0, -21.921], [58.429, 160, 21.921]] },
  'vinay-chibi': { cheeks: [[-12.22, 83.05, 19.0], [12.02, 83.05, 19.1]], radius: 5.59, bounds: [[-39.845, 0, -24.509], [39.845, 120, 24.509]] },
  'shruti-chibi': { cheeks: [[-10.98, 85.97, 18.78], [10.71, 85.97, 18.95]], radius: 5.01, bounds: [[-35.123, 0, -21.941], [35.123, 120, 21.941]] },
}
function blushFor(name, box) {
  const b = BLUSH[name]
  if (!b) return null
  const [lo, hi] = b.bounds.map((v) => new THREE.Vector3(...v))
  const k = box.max.clone().sub(box.min).divide(hi.clone().sub(lo))
  const map = (c) => new THREE.Vector3(...c).sub(lo).multiply(k).add(box.min).toArray()
  return { cheeks: b.cheeks.map(map), radius: b.radius * k.y }
}
const MODELS = {
  classic: { developer: 'vinay', designer: 'shruti' },
  chibi: { developer: 'vinay-chibi', designer: 'shruti-chibi' },
}
const url = (name) => `${base}characters/${name}.glb`
const PROP = { chair: `${base}studio/office-chair.glb`, laptop: `${base}studio/laptop.glb` }

// Bones the wave drives: one hand waves and the other rests on the keys, so typing stops while the
// person says hi (blender/seat_meshy_character.py). The legs keep the typing clip, so they stay seated, and so
// do the spine and head: the wave's own keys throw the torso and head back.
const UPPER = new Set([...['Left', 'Right'].flatMap((side) =>
  ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'Fingers1', 'Fingers2'].map((b) => side + b))])
// Both casts type with their heads level, looking over the laptops; this tilt (radians, about the
// character's own left-right axis) bows the head and neck towards the screen. It eases off while they wave.
const HEAD_TILT = { chibi: 0.3, classic: 0.25 }
const TILT_SHARE = [['neck', 0.3], ['Head', 0.7]]
const UP = new THREE.Vector3(0, 1, 0)
const bone = (track) => track.name.split('.')[0]

// Clothes read as fabric: a faint, broad cloth sheen on the clothing only (a stronger sheen, or a procedural weave,
// made the sleeves and the sides of the torso look padded). The clothing is told apart from skin (bright warm
// peach) and hair (dark warm brown) by the base colour itself, so no mask textures are needed.
const CLOTH_MASK = `
  vec3 srgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float hi = max(srgb.r, max(srgb.g, srgb.b)), lo = min(srgb.r, min(srgb.g, srgb.b));
  float sat = (hi - lo) / max(hi, 1e-4);
  float warmHue = step(srgb.g, srgb.r) * step(srgb.b, srgb.g) * (1.0 - smoothstep(0.55, 0.75, (srgb.g - srgb.b) / max(hi - lo, 1e-4)));
  float skin = warmHue * smoothstep(0.2, 0.28, sat) * (1.0 - smoothstep(0.7, 0.8, sat)) * smoothstep(0.65, 0.8, hi);
  float hair = step(srgb.b, srgb.r) * smoothstep(0.18, 0.26, sat) * (1.0 - smoothstep(0.3, 0.4, hi));
  hair = max(hair, step(neckHeight, vBindHeight)); // the whole head and hair: no cloth sheen
  float clothMask = clamp(1.0 - max(skin, hair), 0.0, 1.0);
`
function fabricMaterial(old, neckHeight, blush) {
  // Matte clay skin and knitwear, as in the reference renders. Meshy's roughness maps are glossy (about 0.6) and the
  // factor only scales them, so the map goes (metalness shares it and is zero anyway). Its normal map adds little
  // beyond ridges along every UV seam, which the live lights turned into bright scratches, so it goes too.
  const material = new THREE.MeshPhysicalMaterial({
    map: old.map, color: old.color,
    roughness: 0.85, metalness: 0, sheen: 1, sheenRoughness: 0.85, sheenColor: new THREE.Color(0.12, 0.11, 0.105),
  })
  if (material.map) {
    // Meshy packs differently coloured patches edge to edge, so the smaller mip levels blend skin into hair along
    // every seam (light lines in the dark hair). Sample the full texture only; anisotropy keeps it from shimmering.
    material.map.generateMipmaps = false
    material.map.minFilter = THREE.LinearFilter
    material.map.anisotropy = 8
    material.map.needsUpdate = true
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.neckHeight = { value: neckHeight }
    shader.uniforms.cheekA = { value: new THREE.Vector3(...(blush?.cheeks[0] ?? [0, -1e4, 0])) }
    shader.uniforms.cheekB = { value: new THREE.Vector3(...(blush?.cheeks[1] ?? [0, -1e4, 0])) }
    shader.uniforms.blushRadius = { value: blush?.radius ?? 1 }
    shader.vertexShader = 'varying float vBindHeight;\nvarying vec3 vBindPos;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBindHeight = position.y;\n  vBindPos = position;')
    shader.fragmentShader = 'varying float vBindHeight;\nvarying vec3 vBindPos;\nuniform float neckHeight, blushRadius;\nuniform vec3 cheekA, cheekB;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + CLOTH_MASK + `
  // soft pink cheeks: strongest at each cheek point, fading out over the blush radius, on skin only
  float cheek = max(exp(-pow(distance(vBindPos, cheekA) / blushRadius, 2.0)), exp(-pow(distance(vBindPos, cheekB) / blushRadius, 2.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.56, 0.58), 0.85 * cheek * skin);`)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.sheenColor *= clothMask;')
      // a little warm glow from within the skin, as light scattering under it would give: less plastic
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += skin * diffuseColor.rgb * vec3(0.16, 0.08, 0.05);')
  }
  material.customProgramCacheKey = () => 'fabric'
  material.userData.fabric = true
  return material
}
const only = (clip, keep, name) => new THREE.AnimationClip(name, clip.duration, clip.tracks.filter((t) => keep(bone(t))))

// A seated character from the Meshy rigs: an eight-second typing loop, and a short wave on hover.
function SeatedPerson({ model, name, intro, peekId, phase = 0, headTilt = 0, neck = 0.82, ...props }) {
  const { scene, animations } = useGLTF(model, false, true)
  const actor = useMemo(() => clone(scene), [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(actor), [actor])
  const actions = useRef({})
  const tilt = useRef(1)
  const greet = useRef(0)
  const neckBones = useMemo(() => TILT_SHARE.map(([name, share]) => [actor.getObjectByName(name), share])
    .filter(([b]) => b).map(([b, share]) => [b, share, b.quaternion.clone()]), [actor])
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), p: new THREE.Quaternion(), d: new THREE.Quaternion(), axis: new THREE.Vector3(),
    f: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3() }), [])
  const chest = useMemo(() => actor.getObjectByName('Spine'), [actor])
  const glance = useRef({ t: 9, next: 6 + phase * 4 + Math.random() * 8, camera: false })
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const [hover, setHover] = useState(false)
  const active = useStore((s) => s.active)
  const peeking = useStore((s) => s.peek === peekId)
  const setPeek = useStore((s) => s.setPeek)
  useCursor(hover && !active && !peeking)

  useLayoutEffect(() => {
    actor.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = o.receiveShadow = true
      o.frustumCulled = false // a bind-pose bounding box cannot represent a seated skinned character
      if (!o.material.userData.fabric) {
        o.geometry.computeBoundingBox()
        const { min, max } = o.geometry.boundingBox // the bind pose, standing (glTF is y-up)
        o.material = fabricMaterial(o.material, min.y + (max.y - min.y) * neck, blushFor(name, o.geometry.boundingBox))
      }
    })
    const clip = (name) => animations.find((a) => a.name === name)
    const typing = clip('TypingIdle')
    const play = (c, time = phase) => {
      const a = mixer.clipAction(c)
      a.setLoop(THREE.LoopRepeat, Infinity).reset().play()
      a.time = time
      return a
    }
    actions.current = {
      lower: play(only(typing, (b) => !UPPER.has(b), 'TypingLower')),
      upper: play(only(typing, (b) => UPPER.has(b), 'TypingUpper')),
      wave: mixer.clipAction(only(clip('Wave'), (b) => UPPER.has(b), 'WaveUpper')),
    }
    actions.current.wave.setLoop(THREE.LoopOnce, 1)
    const done = (e) => {
      if (e.action !== actions.current.wave) return
      actions.current.upper.enabled = true
      actions.current.upper.crossFadeFrom(actions.current.wave, 0.35, false)
    }
    mixer.addEventListener('finished', done)
    mixer.update(0) // apply a seated frame before the first paint, including reduced motion
    actor.updateMatrixWorld(true)
    return () => {
      mixer.removeEventListener('finished', done)
      mixer.stopAllAction()
      mixer.uncacheRoot(actor)
    }
  }, [actor, animations, mixer, phase])

  const wave = () => {
    const { wave, upper } = actions.current
    if (!wave || wave.isRunning() || reduced.matches) return
    wave.reset().play()
    wave.crossFadeFrom(upper, 0.3, false)
  }

  // Rotate a bone about a world axis: local' = parent⁻¹ · q · parent · local
  const turn = (b, axis, angle) => {
    b.parent.getWorldQuaternion(tmp.p)
    tmp.q.setFromAxisAngle(axis, angle)
    tmp.d.copy(tmp.p).invert().multiply(tmp.q).multiply(tmp.p)
    b.quaternion.premultiply(tmp.d)
  }

  useFrame(({ clock, camera }, delta) => {
    const dt = Math.min(delta, 0.1)
    // The typing clip has no head or neck keys, so the mixer leaves those bones alone: put back last
    // frame's untilted pose first, or the tilt would add up frame after frame.
    if (headTilt) for (const [b, , untilted] of neckBones) b.quaternion.copy(untilted)
    mixer.update(reduced.matches ? 0 : Math.min(delta, 0.05))
    if (!headTilt || reduced.matches) return
    const t = clock.elapsedTime + phase * 1.7
    actor.getWorldQuaternion(tmp.p)
    const forward = tmp.f.set(0, 0, 1).applyQuaternion(tmp.p).negate() // the rigs' +z points behind them
    tmp.axis.copy(forward).cross(UP).normalize()                       // their left-right axis, pitching the face down

    // Breathing: the chest rises and settles about every four seconds (the spine bones are keyed, so this resets
    // every frame with the mixer).
    const breath = Math.sin(t * 1.5) * 0.5 + 0.5
    if (chest) turn(chest, tmp.axis, -0.018 * breath)

    // Now and then a glance away from the screen: up across the desk at the other one, or round at the visitor.
    const waving = actions.current.wave?.isRunning()
    const g = glance.current
    g.next -= dt
    if (g.next <= 0 && !waving) Object.assign(g, { t: 0, next: 14 + Math.random() * 16, camera: Math.random() < 0.4 })
    g.t += dt
    const look = waving ? 0 : Math.min(1, g.t / 0.4, Math.max(0, (2.4 - g.t) / 0.5))
    const glancing = THREE.MathUtils.smoothstep(look, 0, 1)
    // While waving they look round at the visitor, easing in and back out with the wave.
    const ease = 1 - Math.exp(-dt * 6)
    greet.current += ((waving ? 1 : 0) - greet.current) * ease
    const lift = Math.max(glancing, greet.current)
    tilt.current += ((waving ? 0 : 1 - glancing) - tilt.current) * ease
    let yaw = 0
    const toCamera = Math.max(g.camera ? glancing : 0, greet.current)
    if (toCamera > 0.001) {
      actor.getWorldPosition(tmp.v)
      const to = tmp.w.copy(camera.position).sub(tmp.v).setY(0).normalize()
      yaw = Math.atan2(forward.x * to.z - forward.z * to.x, forward.x * to.x + forward.z * to.z) * 0.6 * toCamera
      yaw = THREE.MathUtils.clamp(yaw, -0.7, 0.7)
    }
    for (const [b, share, untilted] of neckBones) {
      untilted.copy(b.quaternion)
      turn(b, tmp.axis, headTilt * share * tilt.current - 0.06 * share * lift) // a little above level when looking up
      if (yaw) turn(b, UP, yaw * share)
    }
  })

  return <group {...props} userData={{ studioActor: peekId }}
    onPointerOver={(event) => { event.stopPropagation(); setHover(true); if (!active) wave() }}
    onPointerOut={() => setHover(false)}
    onClick={(event) => {
      event.stopPropagation()
      if (!active && event.delta <= 6) { setPeek(peekId); wave() } // touch screens have no hover
    }}>
    <primitive object={actor} dispose={null} />
    {(hover || peeking) && !active && <Html position={[0, 2.0, 0]} center
      zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag tag--person"><b>{intro.title}</b>{intro.line}</div>
    </Html>}
  </group>
}

// Office chair or laptop: live props, because each character pair sits at its own distance. A laptop shows its
// owner's work on the screen (screens.js).
function Prop({ src, screen, show = null, ...props }) {
  const { scene } = useGLTF(src, false, true)
  const copy = useMemo(() => {
    const c = scene.clone()
    c.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true })
    return c
  }, [scene])
  useLayoutEffect(() => {
    if (!screen) return
    const glass = copy.getObjectByName('Screen'), keys = copy.getObjectByName('Keys')
    if (!glass || !keys) return
    keys.updateWorldMatrix(true, false)
    const centre = new THREE.Box3().setFromObject(keys).getCenter(new THREE.Vector3())
    mapScreen(glass, centre)
    glass.material = new THREE.MeshBasicMaterial({ map: screenTexture(screen), toneMapped: false, color: new THREE.Color(0.82, 0.82, 0.82) })
  }, [copy, screen])
  // While Projects is open, the designer's screen shows the project picked (or hovered) in the panel.
  useLayoutEffect(() => {
    const glass = copy.getObjectByName('Screen')
    if (!screen || !glass?.material.isMeshBasicMaterial) return
    glass.material.map = show === null ? screenTexture(screen) : projectTexture(PROJECTS[show].image)
    glass.material.color.setScalar(show === null ? 0.82 : 1)
  }, [copy, screen, show])
  return <primitive object={copy} {...props} />
}

function Seat({ who, cast, intro, phase }) {
  const s = SEATS[cast][who]
  const show = useStore((st) => who === 'designer' && st.active === 'projects' ? st.preview ?? st.showcase ?? 0 : null)
  return (
    <>
      <SeatedPerson model={url(MODELS[cast][who])} name={MODELS[cast][who]} intro={intro} peekId={who} phase={phase} headTilt={HEAD_TILT[cast]} neck={cast === 'chibi' ? 0.62 : 0.82}
        position={s.person} rotation-y={s.rotation} />
      <Prop src={PROP.chair} position={s.chair} rotation-y={s.chairRotation} />
      <Prop src={PROP.laptop} screen={who === 'developer' ? 'code' : 'design'} show={show} position={s.laptop} rotation-y={s.laptopRotation} scale={s.laptopScale} />
    </>
  )
}

// Face to face across the baked desk. The cast toggle in the top bar swaps the character pair.
export function Team() {
  const cast = useStore((s) => s.cast)
  useEffect(() => { // fetch the other pair in the background so the toggle is instant
    for (const name of Object.values(MODELS[cast === 'chibi' ? 'classic' : 'chibi'])) useGLTF.preload(url(name), false, true)
  }, [cast])
  return (
    <group key={cast}>
      <Seat who="developer" cast={cast} intro={DEVELOPER} />
      <Seat who="designer" cast={cast} intro={DESIGNER} phase={2.3} />
    </group>
  )
}

for (const name of Object.values(MODELS.chibi)) useGLTF.preload(url(name), false, true)
