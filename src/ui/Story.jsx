import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { STORY } from '../content'

// "Our story": a pencil sketches a winding line down the middle as the panel scrolls, and the story
// unfolds beside it one small moment at a time, each with an emoji on the line for the feeling.

const W = 160 // svg width; the line is centred at CX and swings either side of it
const CX = W / 2
const SWAY = 60 // bezier pull; the line drifts about a third of this off centre
const END_GAP = 18 // space kept between the line's end and the "aakaar" sign
const OPEN_BEATS = 2 // beats already sketched when the story opens; the rest wait for scrolling
const EASE = 0.12 // how quickly the pencil catches up with the scroll each frame
const TILT = 28 // the pencil leans like it's held in a right hand

// A winding path through every emoji. Between two beats it bends away from the text it is
// leaving and away from the text it is heading to, so it reads like a road and never cuts a line.
function journeyPath(stops, end) {
  const pts = [0, ...stops, end]
  let d = `M${CX},0`
  for (let i = 1; i < pts.length; i++) {
    const y0 = pts[i - 1]
    const y1 = pts[i]
    const h = y1 - y0
    // beat i-1 has its text on the left when i-1 is even, so leave to the right (and vice versa)
    const s = (i - 1) % 2 === 0 ? 1 : -1
    d += ` C${CX + s * SWAY},${(y0 + h * 0.35).toFixed(1)} ${CX - s * SWAY},${(y1 - h * 0.35).toFixed(1)} ${CX},${y1.toFixed(1)}`
  }
  return d
}

export function Story() {
  const root = useRef()
  const stroke = useRef()
  const pencil = useRef()
  const [layout, setLayout] = useState(null) // { stops: emoji centre ys, end: where the line stops, height }
  const [shown, setShown] = useState(0) // how many beats are revealed
  const [done, setDone] = useState(false)

  // measure where the emojis and the sign sit (fonts and wrapping can move them)
  useLayoutEffect(() => {
    const el = root.current
    const measure = () => {
      const stops = [...el.querySelectorAll('.beat')].map((b) => {
        const e = b.querySelector('.beat__emoji')
        return b.offsetTop + e.offsetTop + e.offsetHeight / 2
      })
      const end = el.querySelector('.tale__end').offsetTop - END_GAP
      setLayout({ stops, end, height: el.offsetHeight })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Scrolling sets where the pencil should be; each frame it eases toward that spot, sketching
  // the line behind it, leaning along the curve and trembling a little while it moves.
  useEffect(() => {
    const el = root.current
    const scroller = el.closest('.panel__scroll')
    const path = stroke.current
    if (!scroller || !layout || !path) return
    const total = path.getTotalLength()
    // the path only ever moves down, so find the length whose point sits at height y
    const lengthAt = (y) => {
      let lo = 0
      let hi = total
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2
        if (path.getPointAtLength(mid).y < y) lo = mid
        else hi = mid
      }
      return hi
    }
    const start = lengthAt(layout.stops[OPEN_BEATS - 1] + 26)

    // the whole scroll range maps onto the rest of the line, so it always finishes at the bottom
    let target = start
    const aim = () => {
      const max = scroller.scrollHeight - scroller.clientHeight
      const f = max > 0 ? Math.min(1, scroller.scrollTop / max) : 1
      target = start + (total - start) * f
    }

    let cur = 0 // starts empty, so the first two beats get sketched as the story opens
    let raf = 0
    let lastShown = -1
    let lastDone = null
    const tick = (t) => {
      const step = (target - cur) * EASE
      cur = Math.abs(target - cur) < 0.3 ? target : cur + step
      const p = path.getPointAtLength(cur)
      const q = path.getPointAtLength(Math.max(0, cur - 8))
      const dir = cur > 8 ? (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI : 90
      const speed = Math.min(1, Math.abs(step) / 4)
      const tremble = Math.sin(t * 0.045) * 4 * speed + Math.sin(t * 0.11) * 1.5 * speed
      const angle = TILT + (dir - 90) * 0.45 + tremble
      path.style.strokeDashoffset = 1 - cur / total
      pencil.current?.setAttribute('transform', `translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})`)

      const n = layout.stops.filter((y) => y - 14 <= p.y).length
      if (n !== lastShown) setShown((lastShown = n))
      const isDone = cur >= total - 1
      if (isDone !== lastDone) setDone((lastDone = isDone))

      raf = cur === target ? 0 : requestAnimationFrame(tick)
    }
    const kick = () => {
      aim()
      if (!raf) raf = requestAnimationFrame(tick)
    }
    kick()
    scroller.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [layout])

  const d = useMemo(() => (layout ? journeyPath(layout.stops, layout.end) : ''), [layout])

  return (
    <div className="tale" ref={root}>
      {layout && (
        <svg className="tale__line" width={W} height={layout.height} viewBox={`0 0 ${W} ${layout.height}`} aria-hidden>
          {/* faint guide, then the drawn graphite stroke on top */}
          <path d={d} className="tale__guide" />
          <path ref={stroke} d={d} className="tale__stroke" pathLength="1" style={{ strokeDashoffset: 1 }} />
          <g ref={pencil} className={`tale__pencil ${done ? 'is-done' : ''}`} transform={`translate(${CX}, 0)`}>
            {/* a tiny pencil with its tip on the origin, pointing down */}
            <g transform="translate(-4,-26)">
              <rect x="0" y="0" width="8" height="18" rx="1.5" fill="#ffb14d" />
              <rect x="0" y="-4" width="8" height="5" rx="1.5" fill="#ff8fc0" />
              <polygon points="0,18 8,18 4,26" fill="#f1d9b5" />
              <polygon points="2.6,22.6 5.4,22.6 4,26" fill="#3a2d26" />
            </g>
          </g>
        </svg>
      )}

      {STORY.map(({ emoji, text, hand }, i) => (
        <div key={i} className={`beat ${i % 2 ? 'beat--right' : 'beat--left'} ${i < shown ? 'is-in' : ''}`}>
          <p className={hand ? 'beat__text beat__text--hand' : 'beat__text'}>{text}</p>
          <span className="beat__emoji" aria-hidden>
            {emoji}
          </span>
        </div>
      ))}

      <div className={`tale__end ${done ? 'is-in' : ''}`}>
        <span className="tale__sign">aakaar</span>
      </div>
    </div>
  )
}
