import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useCursor, useGLTF } from '@react-three/drei'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { DESIGNER, DEVELOPER } from '../content'
import { useStore } from '../store'
import { SEATS } from './views'

const base = import.meta.env.BASE_URL
const MODELS = {
  classic: { developer: 'vinay', designer: 'shruti' },
  chibi: { developer: 'vinay-chibi', designer: 'shruti-chibi' },
}
const url = (name) => `${base}characters/${name}.glb`
const PROP = { chair: `${base}studio/office-chair.glb`, laptop: `${base}studio/laptop.glb` }

// Bones the wave drives: one hand waves and the other rests on the keys, so typing stops while the
// person says hi (blender/seat_meshy_character.py). The legs keep the typing clip, so they stay seated.
const UPPER = new Set(['Spine', 'Spine01', 'Spine02', 'neck', 'Head', ...['Left', 'Right'].flatMap((side) =>
  ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'Fingers1', 'Fingers2'].map((b) => side + b))])
const bone = (track) => track.name.split('.')[0]
const only = (clip, keep, name) => new THREE.AnimationClip(name, clip.duration, clip.tracks.filter((t) => keep(bone(t))))

// A seated character from the Meshy rigs: an eight-second typing loop, and a short wave on hover.
function SeatedPerson({ model, intro, peekId, phase = 0, ...props }) {
  const { scene, animations } = useGLTF(model, false, true)
  const actor = useMemo(() => clone(scene), [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(actor), [actor])
  const actions = useRef({})
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
      o.material.roughness = Math.max(o.material.roughness, 0.75) // matte clay skin and knitwear
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

  useFrame((_, delta) => {
    if (!reduced.matches) mixer.update(Math.min(delta, 0.05))
  })

  return <group {...props} userData={{ studioActor: peekId }}
    onPointerOver={(event) => { event.stopPropagation(); setHover(true); if (!active) wave() }}
    onPointerOut={() => setHover(false)}
    onClick={(event) => {
      event.stopPropagation()
      if (!active && event.delta <= 6) { setPeek(peekId); wave() } // touch screens have no hover
    }}>
    <primitive object={actor} dispose={null} />
    {(hover || peeking) && !active && <Html position={[0, 1.75, 0]} center
      zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="tag tag--person"><b>{intro.title}</b>{intro.line}</div>
    </Html>}
  </group>
}

// Office chair or laptop: live props, because each character pair sits at its own distance.
function Prop({ src, ...props }) {
  const { scene } = useGLTF(src, false, true)
  const copy = useMemo(() => {
    const c = scene.clone()
    c.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true })
    return c
  }, [scene])
  return <primitive object={copy} {...props} />
}

function Seat({ who, cast, intro, phase }) {
  const s = SEATS[cast][who]
  return (
    <>
      <SeatedPerson model={url(MODELS[cast][who])} intro={intro} peekId={who} phase={phase} position={s.person} rotation-y={s.rotation} />
      <Prop src={PROP.chair} position={s.chair} rotation-y={s.chairRotation} />
      <Prop src={PROP.laptop} position={s.laptop} rotation-y={s.laptopRotation} />
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
