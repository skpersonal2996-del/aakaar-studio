import * as THREE from 'three'

// What each laptop shows: Vinay is in a code editor, Shruti in a design tool. Drawn once on a canvas.
const W = 640, H = 400

function editor(ctx) {
  ctx.fillStyle = '#1b1d24'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#15171d'; ctx.fillRect(0, 0, 120, H) // file tree
  ctx.fillStyle = '#23262f'; ctx.fillRect(120, 0, W - 120, 26) // tabs
  ctx.fillStyle = '#1b1d24'; ctx.fillRect(126, 4, 110, 22)
  ctx.fillStyle = '#ff7eb6'; ctx.fillRect(126, 4, 110, 2)
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i === 3 ? '#2d3140' : 'transparent'; ctx.fillRect(0, 40 + i * 22, 120, 20)
    ctx.fillStyle = i % 4 === 0 ? '#e0b46a' : '#8a90a0'
    ctx.fillRect(14 + (i % 3 === 0 ? 0 : 12), 47 + i * 22, 50 + ((i * 37) % 40), 6)
  }
  const palette = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#d0d4e0']
  let seed = 7
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let line = 0; line < 15; line++) {
    const y = 44 + line * 23
    ctx.fillStyle = '#4b5060'; ctx.fillRect(132, y, 14, 6) // line number
    let x = 160 + (line % 5 === 0 ? 0 : 18 * (1 + (line % 3)))
    const words = 2 + Math.floor(rand() * 5)
    for (let w = 0; w < words && x < W - 30; w++) {
      const len = 20 + rand() * 70
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)]
      ctx.fillRect(x, y, len, 7); x += len + 10
    }
  }
  ctx.fillStyle = '#ff7eb6'; ctx.fillRect(330, 44 + 9 * 23 - 4, 2, 15) // cursor
  ctx.fillStyle = '#2a2d38'; ctx.fillRect(120, H - 22, W - 120, 22) // status bar
  ctx.fillStyle = '#c3e88d'; ctx.fillRect(132, H - 14, 60, 6)
}

function design(ctx) {
  ctx.fillStyle = '#f3f1ee'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 110, H); ctx.fillRect(W - 120, 0, 120, H) // layers, properties
  ctx.fillStyle = '#e6e2dc'; ctx.fillRect(0, 0, W, 24) // toolbar
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i === 1 ? '#ff7eb6' : '#b9b2a8'; ctx.fillRect(250 + i * 26, 7, 12, 10) }
  for (let i = 0; i < 11; i++) {
    ctx.fillStyle = i === 2 ? '#ffe1ee' : 'transparent'; ctx.fillRect(4, 36 + i * 22, 102, 18)
    ctx.fillStyle = '#9a938a'; ctx.fillRect(12 + (i % 3 ? 10 : 0), 43 + i * 22, 44 + ((i * 29) % 34), 5)
  }
  // two phone frames on the canvas
  for (const [x, accent] of [[150, '#ff7eb6'], [320, '#7b8cff']]) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 50, 140, 280)
    ctx.strokeStyle = '#ff7eb6'; ctx.lineWidth = x === 150 ? 2 : 0; if (x === 150) ctx.strokeRect(x - 1, 49, 142, 282)
    ctx.fillStyle = accent; ctx.fillRect(x + 12, 70, 116, 70)
    ctx.fillStyle = '#2b2622'; ctx.fillRect(x + 12, 152, 90, 9); ctx.fillRect(x + 12, 168, 70, 6)
    ctx.fillStyle = '#d8d2c9'; for (let r = 0; r < 4; r++) ctx.fillRect(x + 12, 190 + r * 26, 116, 18)
    ctx.fillStyle = '#2b2622'; ctx.fillRect(x + 12, 300, 116, 18)
  }
  // properties: colour swatches and sliders
  ;['#ff7eb6', '#7b8cff', '#ffd27b', '#2b2622'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(W - 108 + i * 26, 44, 20, 20) })
  for (let r = 0; r < 6; r++) {
    ctx.fillStyle = '#e6e2dc'; ctx.fillRect(W - 108, 84 + r * 30, 96, 6)
    ctx.fillStyle = '#ff7eb6'; ctx.fillRect(W - 108, 84 + r * 30, 30 + ((r * 23) % 60), 6)
  }
}

const cache = {}
export function screenTexture(kind) {
  if (cache[kind]) return cache[kind]
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  ;(kind === 'design' ? design : editor)(canvas.getContext('2d'))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return (cache[kind] = texture)
}

// A project's screenshot, cropped to fill the laptop screen (the images are 3:2, the screen 16:10).
export function projectTexture(src) {
  if (cache[src]) return cache[src]
  const canvas = document.createElement('canvas')
  canvas.width = 1280; canvas.height = 800
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const image = new Image()
  image.onload = () => {
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
    const w = image.width * scale, h = image.height * scale
    canvas.getContext('2d').drawImage(image, (canvas.width - w) / 2, 0, w, h) // keep the top: the site's header
    texture.needsUpdate = true
  }
  image.src = src
  return (cache[src] = texture)
}

// The laptop's screen has no UVs: lay the picture across the face that looks at the keyboard, upright, in world space.
export function mapScreen(screen, keyboardCentre) {
  screen.geometry = screen.geometry.clone()
  screen.updateWorldMatrix(true, false)
  const g = screen.geometry, pos = g.attributes.position, nrm = g.attributes.normal
  const box = new THREE.Box3().setFromBufferAttribute(pos)
  const centre = box.getCenter(new THREE.Vector3()).applyMatrix4(screen.matrixWorld)
  const toKeys = keyboardCentre.clone().sub(centre)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(screen.matrixWorld)
  // the screen is a thin box: its face is the side pointing most directly at the keys
  let front = null, best = 0
  toKeys.normalize()
  for (let i = 0; i < nrm.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize()
    if (n.dot(toKeys) > best && Math.abs(n.y) < 0.95) [front, best] = [n, n.dot(toKeys)]
  }
  if (!front) return
  const right = new THREE.Vector3(0, 1, 0).cross(front).normalize()
  const up = front.clone().cross(right).normalize()
  const world = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(screen.matrixWorld))
  const xs = world.map((p) => p.dot(right)), ys = world.map((p) => p.dot(up))
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  g.setAttribute('uv', new THREE.Float32BufferAttribute(world.flatMap((_, i) => [(xs[i] - x0) / (x1 - x0), (ys[i] - y0) / (y1 - y0)]), 2))
}
