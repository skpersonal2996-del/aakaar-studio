import * as THREE from 'three'

// Every surface texture is painted procedurally on a canvas, so the site ships no image assets.

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

// soft: for surfaces nobody looks at closely (floor, walls, fabrics, wall art). Half the
// resolution and less anisotropic filtering, so they cost less to sample and read slightly
// softer, keeping the eye on the sign, the people, the laptops and the ID wall.
function toTex(c, { repeat, srgb = true, soft = false } = {}) {
  const t = new THREE.CanvasTexture(soft ? shrink(c, 0.5) : c)
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = soft ? 2 : 8
  return t
}

const cache = new Map()
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key)
}

function grain(x, r, x0, y0, w, h, lines, vertical) {
  for (let g = 0; g < lines; g++) {
    const dark = r() < 0.6
    x.strokeStyle = dark ? `rgba(25,12,5,${0.05 + r() * 0.12})` : `rgba(255,214,170,${0.03 + r() * 0.06})`
    x.lineWidth = 0.6 + r() * 1.6
    x.beginPath()
    const off = r() * (vertical ? w : h)
    const amp = 0.5 + r() * 2.5
    const freq = 0.004 + r() * 0.012
    const ph = r() * 10
    const len = vertical ? h : w
    for (let s = 0; s <= len; s += 8) {
      const d = Math.sin(s * freq + ph) * amp
      if (vertical) x.lineTo(x0 + off + d, y0 + s)
      else x.lineTo(x0 + s, y0 + off + d)
    }
    x.stroke()
  }
}

export const woodFloor = () =>
  memo('floor', () => {
    const [c, x] = canvas(1024, 1024)
    const r = rng(3)
    const rows = 8
    const rh = 1024 / rows
    for (let i = 0; i < rows; i++) {
      let px = -r() * 500
      while (px < 1024) {
        const len = 300 + r() * 420
        x.fillStyle = `hsl(${26 + r() * 8},${24 + r() * 12}%,${22 + r() * 11}%)`
        x.fillRect(px, i * rh, len, rh)
        x.save()
        x.beginPath()
        x.rect(px, i * rh, len, rh)
        x.clip()
        grain(x, r, px, i * rh, len, rh, 22, false)
        x.restore()
        x.fillStyle = 'rgba(8,4,2,.75)'
        x.fillRect(px, i * rh, 2, rh)
        px += len
      }
      x.fillStyle = 'rgba(8,4,2,.8)'
      x.fillRect(0, i * rh, 1024, 2)
    }
    return toTex(c, { soft: true, repeat: [4, 14 / 3] })
  })

export const plaster = () =>
  memo('plaster', () => {
    const [c, x] = canvas(512, 512)
    const r = rng(9)
    x.fillStyle = '#7d7671'
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 40000; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.07})` : `rgba(255,255,255,${r() * 0.05})`
      x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2)
    }
    return toTex(c, { soft: true, repeat: [4, 2] })
  })

export const woodGrain = (key = 'walnut', hue = 24, light = 30) =>
  memo('wood-' + key, () => {
    const [c, x] = canvas(256, 1024)
    const r = rng(hue * 7 + light)
    x.fillStyle = `hsl(${hue},42%,${light}%)`
    x.fillRect(0, 0, 256, 1024)
    grain(x, r, 0, 0, 256, 1024, 70, true)
    return toTex(c, { soft: true })
  })

export const fabric = (key, base, repeat = [3, 3]) =>
  memo('fabric-' + key, () => {
    const [c, x] = canvas(256, 256)
    const r = rng(key.length * 13)
    x.fillStyle = base
    x.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 256; i += 2) {
      x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`
      x.fillRect(0, i, 256, 1)
      x.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`
      x.fillRect(i, 0, 1, 256)
    }
    for (let i = 0; i < 5000; i++) {
      x.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'
      x.fillRect(r() * 256, r() * 256, 1, 1)
    }
    return toTex(c, { soft: true, repeat })
  })

export const rug = () =>
  memo('rug', () => {
    const [c, x] = canvas(512, 512)
    const r = rng(21)
    x.fillStyle = '#b8521c'
    x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 26000; i++) {
      const a = r() * Math.PI * 2
      const l = 2 + r() * 6
      const px = r() * 512
      const py = r() * 512
      x.strokeStyle = `hsla(${18 + r() * 14},${70 + r() * 20}%,${30 + r() * 25}%,.6)`
      x.lineWidth = 1 + r()
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l)
      x.stroke()
    }
    return toTex(c, { soft: true, repeat: [3, 2.5] })
  })

export const check = () =>
  memo('check', () => {
    const [c, x] = canvas(128, 128)
    x.fillStyle = '#e8b9b6'
    x.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 128; i += 16) {
      x.fillStyle = 'rgba(190,60,80,.55)'
      x.fillRect(i, 0, 7, 128)
      x.fillRect(0, i, 128, 7)
    }
    return toTex(c, { soft: true, repeat: [2, 2] })
  })

export const pegboard = () =>
  memo('peg', () => {
    const [c, x] = canvas(760, 480)
    x.fillStyle = '#1a1a1c'
    x.fillRect(0, 0, 760, 480)
    x.fillStyle = '#050505'
    for (let i = 10; i < 760; i += 20)
      for (let j = 10; j < 480; j += 20) {
        x.beginPath()
        x.arc(i, j, 3.4, 0, Math.PI * 2)
        x.fill()
      }
    return toTex(c)
  })

export const softboxGrid = () =>
  memo('softbox', () => {
    const [c, x] = canvas(256, 192)
    x.fillStyle = '#0a0a0a'
    x.fillRect(0, 0, 256, 192)
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 12; j++) {
        const g = x.createRadialGradient(i * 16 + 8, j * 16 + 8, 0, i * 16 + 8, j * 16 + 8, 8)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(1, '#bfc3c8')
        x.fillStyle = g
        x.fillRect(i * 16 + 2, j * 16 + 2, 12, 12)
      }
    return toTex(c)
  })

// Studio ID card with a real photo. The card is drawn straight away; the photo is painted in
// (cover-cropped to the frame) as soon as it has loaded.
export const photoCard = ({ name, card, color, photo }) =>
  memo('photo-card-' + name, () => {
    const [c, x] = canvas(320, 480)
    const tex = toTex(c)
    const frame = { x: 40, y: 104, w: 240, h: 230 }
    const paint = (img) => {
      x.fillStyle = '#f4f1ec'
      x.fillRect(0, 0, 320, 480)
      x.fillStyle = color
      x.fillRect(0, 0, 320, 84)
      x.fillStyle = 'rgba(0,0,0,.25)'
      x.fillRect(136, 14, 48, 10) // lanyard slot
      x.fillStyle = '#fff'
      x.textAlign = 'center'
      x.font = '500 34px "Comfortaa", sans-serif'
      x.fillText('aakaar', 160, 64)
      x.fillStyle = '#d9d2c7'
      x.fillRect(frame.x, frame.y, frame.w, frame.h)
      if (img) {
        // cover-crop, biased upwards so faces stay in frame
        const s = Math.max(frame.w / img.width, frame.h / img.height)
        const w = frame.w / s
        const h = frame.h / s
        x.drawImage(img, (img.width - w) / 2, (img.height - h) * 0.2, w, h, frame.x, frame.y, frame.w, frame.h)
      }
      x.fillStyle = '#1b1b1b'
      x.font = '700 34px "Space Grotesk", sans-serif'
      x.fillText(name, 160, 386)
      x.fillStyle = color
      x.font = '500 20px "JetBrains Mono", monospace'
      x.fillText(card.toUpperCase(), 160, 418)
      x.fillStyle = '#555'
      x.font = '500 15px "JetBrains Mono", monospace'
      x.fillText('COFOUNDER', 160, 446)
      tex.needsUpdate = true
    }
    paint(null)
    const img = new Image()
    img.onload = () => paint(img)
    img.src = photo
    return tex
  })

export const idCard = ({ company, color, name, role, years }) =>
  memo('card-' + company, () => {
    const [c, x] = canvas(256, 384)
    x.fillStyle = '#f4f1ec'
    x.fillRect(0, 0, 256, 384)
    x.fillStyle = color
    x.fillRect(0, 0, 256, 92)
    x.fillStyle = 'rgba(0,0,0,.25)'
    x.fillRect(108, 14, 40, 10)
    x.fillStyle = '#fff'
    x.font = '700 26px "Space Grotesk", sans-serif'
    x.textAlign = 'center'
    x.fillText(company, 128, 66)
    // little illustrated portrait
    x.save()
    x.beginPath()
    x.rect(78, 104, 100, 98)
    x.clip()
    x.fillStyle = '#e9dccb'
    x.fillRect(78, 104, 100, 98)
    const pr = rng(company.length * 3)
    x.fillStyle = ['#2d2a33', '#c4592b', '#3e6b56', '#e6dccb'][Math.floor(pr() * 4)]
    x.beginPath()
    x.ellipse(128, 206, 40, 30, 0, Math.PI, 0)
    x.fill()
    x.fillStyle = ['#c68e6b', '#a8714f', '#e0b48f'][Math.floor(pr() * 3)]
    x.fillRect(121, 160, 14, 18)
    x.beginPath()
    x.ellipse(128, 146, 19, 23, 0, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = '#1d1410'
    x.beginPath()
    x.ellipse(128, 131, 21, 12, 0, Math.PI, 0)
    x.fill()
    if (pr() > 0.5) x.fillRect(107, 128, 7, 30)
    x.restore()
    x.fillStyle = '#1b1b1b'
    x.font = '700 24px "Space Grotesk", sans-serif'
    x.fillText(name, 128, 236)
    x.fillStyle = '#555'
    x.font = '500 17px "JetBrains Mono", monospace'
    x.fillText(role, 128, 266)
    x.fillText(years, 128, 292)
    x.fillStyle = '#222'
    const r = rng(company.length)
    for (let i = 40; i < 216; i += 4) if (r() > 0.35) x.fillRect(i, 316, r() > 0.5 ? 2 : 3, 40)
    return toTex(c)
  })

export const laptopScreen = (variant) =>
  memo('screen-' + variant, () => {
    const [c, x] = canvas(1024, 660)
    x.fillStyle = '#121014'
    x.fillRect(0, 0, 1024, 660)
    x.fillStyle = '#1d1a20'
    x.fillRect(0, 0, 1024, 44)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      x.fillStyle = col
      x.beginPath()
      x.arc(26 + i * 22, 22, 7, 0, Math.PI * 2)
      x.fill()
    })
    if (variant === 'projects') {
      x.fillStyle = '#ff6fae'
      x.font = '700 64px "Space Grotesk", sans-serif'
      x.fillText('PROJECTS', 60, 130)
      x.fillStyle = '#8b8590'
      x.font = '500 22px "JetBrains Mono", monospace'
      x.fillText('aakaar.studio / selected work', 62, 170)
      const cols = [
        ['#ff7a3d', '#ff3d8b'],
        ['#2fd1c5', '#2a5bd7'],
        ['#f6c445', '#ff7a3d'],
        ['#9b6bff', '#ff6fae'],
        ['#2a2a35', '#57576a'],
        ['#7ee081', '#2fa572'],
      ]
      cols.forEach(([a, b], i) => {
        const px = 60 + (i % 3) * 310
        const py = 210 + Math.floor(i / 3) * 210
        const g = x.createLinearGradient(px, py, px + 280, py + 180)
        g.addColorStop(0, a)
        g.addColorStop(1, b)
        x.fillStyle = g
        x.beginPath()
        x.roundRect(px, py, 280, 180, 16)
        x.fill()
      })
    } else {
      // a design tool with frames on a canvas
      x.fillStyle = '#18161b'
      x.fillRect(0, 44, 200, 616)
      x.fillRect(824, 44, 200, 616)
      for (let i = 0; i < 12; i++) {
        x.fillStyle = i === 3 ? '#ff6fae55' : '#2a272e'
        x.fillRect(16, 70 + i * 34, 150 - (i % 3) * 30, 18)
        x.fillStyle = '#2a272e'
        x.fillRect(840, 70 + i * 40, 160, 22)
      }
      const frames = [
        [240, 90, 170, 320, '#f4efe9'],
        [430, 90, 170, 320, '#ff7a3d'],
        [620, 90, 170, 320, '#1f2b4d'],
        [240, 440, 550, 180, '#2fd1c5'],
      ]
      frames.forEach(([px, py, w, h, col]) => {
        x.fillStyle = col
        x.fillRect(px, py, w, h)
        x.fillStyle = 'rgba(0,0,0,.18)'
        x.fillRect(px + 16, py + 20, w * 0.6, 14)
        x.fillRect(px + 16, py + 44, w * 0.4, 10)
      })
      x.strokeStyle = '#ff6fae'
      x.lineWidth = 3
      x.strokeRect(430, 90, 170, 320)
    }
    return toTex(c)
  })

export const phoneScreen = () =>
  memo('phone', () => {
    const [c, x] = canvas(200, 410)
    const g = x.createLinearGradient(0, 0, 200, 410)
    g.addColorStop(0, '#ff7a3d')
    g.addColorStop(1, '#ff3d8b')
    x.fillStyle = g
    x.fillRect(0, 0, 200, 410)
    x.fillStyle = '#fff'
    x.textAlign = 'center'
    x.font = '600 46px "Space Grotesk", sans-serif'
    x.fillText('23:25', 100, 110)
    x.font = '500 15px "JetBrains Mono", monospace'
    x.fillText('1 new message', 100, 300)
    x.fillText('“let’s build it”', 100, 324)
    return toTex(c)
  })

export const artPrint = (seed) =>
  memo('art-' + seed, () => {
    const [c, x] = canvas(300, 400)
    const r = rng(seed)
    x.fillStyle = '#efe6da'
    x.fillRect(0, 0, 300, 400)
    const pal = ['#ff7a3d', '#1f2b4d', '#ff6fae', '#2fa572', '#f6c445']
    for (let i = 0; i < 5; i++) {
      x.fillStyle = pal[Math.floor(r() * pal.length)]
      x.beginPath()
      if (r() > 0.5) x.arc(60 + r() * 180, 60 + r() * 280, 30 + r() * 70, 0, Math.PI * 2)
      else x.rect(30 + r() * 160, 30 + r() * 260, 40 + r() * 100, 40 + r() * 120)
      x.fill()
    }
    return toTex(c, { soft: true })
  })

export const bwArt = () =>
  memo('bw-art', () => {
    const [c, x] = canvas(360, 480)
    x.fillStyle = '#efe9df'
    x.fillRect(0, 0, 360, 480)
    x.fillStyle = '#141211'
    x.beginPath()
    x.arc(120, 150, 110, Math.PI / 2, Math.PI * 1.5, true)
    x.fill()
    x.fillRect(10, 40, 110, 220)
    x.beginPath()
    x.arc(250, 330, 100, -Math.PI / 2, Math.PI / 2)
    x.fill()
    x.fillRect(150, 230, 100, 200)
    x.fillStyle = '#efe9df'
    x.beginPath()
    x.arc(120, 150, 52, 0, Math.PI * 2)
    x.fill()
    return toTex(c, { soft: true })
  })

export const poster = () =>
  memo('poster', () => {
    const [c, x] = canvas(360, 500)
    x.fillStyle = '#f1ece3'
    x.fillRect(0, 0, 360, 500)
    x.fillStyle = '#1c1a18'
    x.font = '500 50px "Space Grotesk", sans-serif'
    ;['Good', 'Design', 'Builds', 'Better', 'Futures'].forEach((w, i) => x.fillText(w, 34, 92 + i * 64))
    x.fillStyle = '#c4592b'
    x.fillRect(34, 420, 46, 8)
    return toTex(c, { soft: true })
  })

export const jute = (key = 'jute', base = '#8a7356') =>
  memo('rug-' + key, () => {
    const [c, x] = canvas(512, 512)
    const r = rng(key.length * 31)
    x.fillStyle = base
    x.fillRect(0, 0, 512, 512)
    for (let j = 0; j < 512; j += 6)
      for (let i = 0; i < 512; i += 6) {
        const l = r()
        x.fillStyle = `rgba(${l > 0.5 ? '255,235,200' : '30,20,10'},${0.08 + r() * 0.14})`
        x.fillRect(i + ((j / 6) % 2) * 3, j, 4, 5)
      }
    // woven border
    x.strokeStyle = 'rgba(30,20,10,.35)'
    x.lineWidth = 10
    x.strokeRect(14, 14, 484, 484)
    const t = toTex(c, { soft: true })
    return t
  })

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
    draw(name, '500 400px "Comfortaa"', 400, halo, face, 80, '0px')
    draw(tagline.toUpperCase(), '600 62px "Space Grotesk"', 760, halo, faceSmall, 26, '18px')
    return toTex(c)
  })

// Knit stitch pattern used as a bump map on the sweaters (columns of little V stitches).
export const knitBump = () =>
  memo('knit-bump', () => {
    const [c, x] = canvas(128, 128)
    x.fillStyle = '#808080'
    x.fillRect(0, 0, 128, 128)
    for (let col = 0; col < 8; col++)
      for (let row = 0; row < 8; row++) {
        const cx = col * 16 + 8
        const cy = row * 16
        const g = x.createLinearGradient(cx - 8, 0, cx + 8, 0)
        g.addColorStop(0, '#5a5a5a')
        g.addColorStop(0.5, '#d0d0d0')
        g.addColorStop(1, '#5a5a5a')
        x.fillStyle = g
        x.beginPath()
        x.moveTo(cx - 7, cy)
        x.quadraticCurveTo(cx - 2, cy + 10, cx, cy + 16)
        x.quadraticCurveTo(cx + 2, cy + 10, cx + 7, cy)
        x.quadraticCurveTo(cx, cy + 6, cx - 7, cy)
        x.fill()
      }
    return toTex(c, { repeat: [10, 6], srgb: false })
  })

export const marble = () =>
  memo('marble', () => {
    const [c, x] = canvas(512, 512)
    const r = rng(77)
    x.fillStyle = '#efebe5'
    x.fillRect(0, 0, 512, 512)
    for (let v = 0; v < 14; v++) {
      x.strokeStyle = `rgba(120,110,100,${0.08 + r() * 0.18})`
      x.lineWidth = 0.6 + r() * 2.2
      x.beginPath()
      let px = r() * 512
      let py = 0
      x.moveTo(px, py)
      while (py < 512) {
        px += (r() - 0.5) * 40
        py += 10 + r() * 30
        x.lineTo(px, py)
      }
      x.stroke()
    }
    return toTex(c, { soft: true })
  })

// A book spine with its title (and author) printed on it, for the bookshelf.
// upright: text runs top to bottom like an English spine; otherwise the book lies flat and the
// title reads left to right. w/h are the spine face's size in metres.
export const bookSpine = ({ key, title, author, bg, ink, accent = ink, upright, w, h, serif }) =>
  memo(`spine:${key}:${upright}`, () => {
    const PX = 2400 // pixels per metre, so small spines stay legible up close
    const [c, x] = canvas(Math.round(w * PX), Math.round(h * PX))
    x.fillStyle = bg
    x.fillRect(0, 0, c.width, c.height)
    // the long axis of the spine, along which the text runs
    const long = upright ? c.height : c.width
    const short = upright ? c.width : c.height
    if (upright) {
      x.translate(c.width / 2, 0)
      x.rotate(Math.PI / 2)
      x.translate(0, -c.width / 2)
    }
    // thin bands near each end, like a printed jacket
    x.fillStyle = accent
    x.globalAlpha = 0.85
    x.fillRect(long * 0.035, short * 0.12, Math.max(2, long * 0.008), short * 0.76)
    x.fillRect(long * 0.957, short * 0.12, Math.max(2, long * 0.008), short * 0.76)
    x.globalAlpha = 1
    const family = serif ? 'Georgia, "Times New Roman", serif' : '"Space Grotesk", sans-serif'
    x.fillStyle = ink
    x.textBaseline = 'middle'
    // author at the far end, small
    let authorW = 0
    if (author) {
      const af = short * 0.26
      x.font = `500 ${af}px ${family}`
      authorW = Math.min(x.measureText(author).width, long * 0.32)
      x.textAlign = 'right'
      x.globalAlpha = 0.8
      x.fillText(author, long * 0.93, short / 2, long * 0.32)
      x.globalAlpha = 1
    }
    // title fills what's left, shrinking until it fits
    const room = long * 0.86 - authorW - (author ? long * 0.05 : 0)
    let size = short * 0.5
    x.font = `700 ${size}px ${family}`
    while (x.measureText(title).width > room && size > short * 0.22) {
      size -= 1
      x.font = `700 ${size}px ${family}`
    }
    x.textAlign = 'left'
    x.fillText(title, long * 0.07, short / 2 + size * 0.04, room)
    return toTex(c)
  })
