import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { useStore } from '../store'
import { HOME, INTRO, PEEKS, VIEWS } from './views'

const { ACTION } = CameraControlsImpl

// Spherical angles of the home view, so drag limits are centred on it.
const offset = new THREE.Vector3().fromArray(HOME.pos).sub(new THREE.Vector3().fromArray(HOME.target))
const homeSph = new THREE.Spherical().setFromVector3(offset)

// Drag range keeps the camera looking into the room: from the ID wall on the right
// to a good look at the bookshelf on the left, never past the walls or under the desk.
function lock(c, radius) {
  c.minAzimuthAngle = homeSph.theta - 0.32 // looking right
  c.maxAzimuthAngle = homeSph.theta + 0.72 // looking left, well onto the bookshelf
  c.minPolarAngle = homeSph.phi - 0.16
  c.maxPolarAngle = homeSph.phi + 0.1
  c.minDistance = radius * 0.75
  c.maxDistance = radius * 1.12
}

function unlock(c) {
  c.minAzimuthAngle = -Infinity
  c.maxAzimuthAngle = Infinity
  c.minPolarAngle = 0
  c.maxPolarAngle = Math.PI
  c.minDistance = 0.1
  c.maxDistance = 100
}

// While a panel is open the object is framed in the visible (left) part of the screen.
function framed(view, wide) {
  const pos = new THREE.Vector3().fromArray(view.pos)
  const target = new THREE.Vector3().fromArray(view.target)
  if (wide) {
    const dir = target.clone().sub(pos)
    const right = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize()
    const shift = right.multiplyScalar(dir.length() * 0.2)
    pos.add(shift)
    target.add(shift)
  } else {
    // On narrow screens the panel is a bottom sheet, so lift the object into the upper half.
    target.y -= pos.distanceTo(target) * 0.16
  }
  return [...pos.toArray(), ...target.toArray()]
}

// drei only ticks the controls while `enabled`, so block input by unmapping actions instead.
function setInput(c, on) {
  c.mouseButtons.left = on ? ACTION.ROTATE : ACTION.NONE
  c.mouseButtons.wheel = on ? ACTION.DOLLY : ACTION.NONE
  c.touches.one = on ? ACTION.TOUCH_ROTATE : ACTION.NONE
  c.touches.two = on ? ACTION.TOUCH_DOLLY : ACTION.NONE
}

export function CameraRig() {
  const ref = useRef()
  const size = useThree((s) => s.size)
  const active = useStore((s) => s.active)
  const entered = useStore((s) => s.entered)
  const resetTick = useStore((s) => s.resetTick)
  const peek = useStore((s) => s.peek)
  const wide = size.width > 860
  // Portrait screens see less of the room, so the home view backs away from it.
  const k = THREE.MathUtils.clamp(1.25 / (size.width / size.height), 1, 1.75)
  // back away along the view direction (as if the old 8m orbit were scaled by k)
  const homePos = useMemo(
    () => new THREE.Vector3().fromArray(HOME.pos).addScaledVector(offset.clone().normalize(), (k - 1) * 8).toArray(),
    [k],
  )
  const homeRadius = new THREE.Vector3().fromArray(homePos).distanceTo(new THREE.Vector3().fromArray(HOME.target))

  useEffect(() => {
    const c = ref.current
    c.mouseButtons.right = ACTION.NONE
    c.mouseButtons.middle = ACTION.NONE
    c.touches.three = ACTION.NONE
    c.dollyToCursor = false
    c.azimuthRotateSpeed = 0.35
    c.polarRotateSpeed = 0.3
    c.dollySpeed = 0.4
    c.draggingSmoothTime = 0.18
    setInput(c, false)
    c.setLookAt(...INTRO.pos, ...INTRO.target, false)
    if (import.meta.env.DEV) window.__controls = c
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!entered) return
    let cancelled = false
    unlock(c)
    setInput(c, false)
    if (active) {
      c.smoothTime = 0.65
      c.setLookAt(...framed(VIEWS[active], wide), true)
    } else if (peek) {
      c.smoothTime = 0.7
      c.setLookAt(...PEEKS[peek].pos, ...PEEKS[peek].target, true)
    } else {
      c.smoothTime = 0.75
      c.setLookAt(...homePos, ...HOME.target, true).then(() => {
        if (cancelled) return
        lock(c, homeRadius)
        setInput(c, true)
        c.smoothTime = 0.35
      })
    }
    return () => {
      cancelled = true
    }
  }, [active, entered, wide, k, resetTick, peek])

  return <CameraControls ref={ref} makeDefault />
}
