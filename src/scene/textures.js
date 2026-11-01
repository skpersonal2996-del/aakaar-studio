import * as THREE from 'three'

// Canvas-painted textures for the live (unbaked) parts of the room: the sign and the city view.

export function rng(seed = 1) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// Paint at full size, then scale the finished canvas down (the painting code stays in one size).
export function shrink(c, f) {
  const [s, x] = canvas(Math.round(c.width * f), Math.round(c.height * f))
  x.imageSmoothingQuality = 'high'
  x.drawImage(c, 0, 0, s.width, s.height)
  return s
}

function toTex(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const cache = new Map()
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key)
}

export const signTexture = (name, tagline, halo = '#ff9a3d', face = '#fff3e2', faceSmall = '#ffe7c8') =>
  memo('sign-' + name + halo, () => {
    const [c, x] = canvas(2048, 900)
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const draw = (text, font, y, halo, face, blur, spacing) => {
      x.font = font
      x.letterSpacing = spacing
      x.shadowColor = halo
      for (const [b, a] of [
        [blur * 2.4, 0.6],
        [blur, 0.85],
      ]) {
        x.shadowBlur = b
        x.globalAlpha = a
        x.fillStyle = halo
        x.fillText(text, 1024, y)
      }
      x.globalAlpha = 1
      x.shadowBlur = blur * 0.15
      x.shadowColor = face
      x.fillStyle = face
      x.fillText(text, 1024, y)
    }
    draw(name, '500 400px "Comfortaa Variable"', 400, halo, face, 80, '0px')
    draw(tagline.toUpperCase(), '600 62px "Space Grotesk Variable"', 760, halo, faceSmall, 26, '18px')
    return toTex(c)
  })
