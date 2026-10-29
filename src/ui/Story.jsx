import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { STORY } from '../content'

// "Our story": a pencil line winds down the middle as the panel scrolls, and the story
// unfolds beside it one small moment at a time, each with an emoji on the line for the feeling.

const W = 160 // svg width; the line is centred at CX and swings either side of it
const CX = W / 2
const SWAY = 60 // bezier pull; the line drifts about a third of this off centre
const END_GAP = 18 // space kept between the line's end and the "aakaar" sign

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
  const [layout, setLayout] = useState(null) // { stops: emoji centre ys, end: where the line stops }
  const [draw, setDraw] = useState({ frac: 0, x: CX, y: 0 }) // how much of the line is drawn, and its tip
  const [shown, setShown] = useState(1) // how many beats are revealed

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

  // draw the line and reveal beats as the panel scrolls
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
    const update = () => {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      // the "pencil tip" sits about two thirds down the visible area
      const tip = Math.max(0, Math.min(layout.end, scroller.clientHeight * 0.68 - top))
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      const len = atEnd ? total : lengthAt(tip)
      const p = path.getPointAtLength(len)
      setDraw({ frac: len / total, x: p.x, y: p.y })
      let n = 0
      layout.stops.forEach((y) => {
        if (y - 20 < (atEnd ? Infinity : tip)) n++
      })
      setShown(Math.max(1, n))
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      scroller.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [layout])

  const d = useMemo(() => (layout ? journeyPath(layout.stops, layout.end) : ''), [layout])
  const done = draw.frac >= 0.995

  return (
    <div className="tale" ref={root}>
      {layout && (
        <svg className="tale__line" width={W} height={layout.height} viewBox={`0 0 ${W} ${layout.height}`} aria-hidden>
          {/* faint guide, then the drawn graphite stroke on top */}
          <path d={d} className="tale__guide" />
          <path ref={stroke} d={d} className="tale__stroke" pathLength="1" style={{ strokeDashoffset: 1 - draw.frac }} />
          {!done && (
            <g transform={`translate(${draw.x}, ${draw.y})`} className="tale__pencil">
              {/* a tiny pencil, tip down */}
              <g transform="rotate(200) translate(-4,-26)">
                <rect x="0" y="0" width="8" height="18" rx="1.5" fill="#ffb14d" />
                <rect x="0" y="-4" width="8" height="5" rx="1.5" fill="#ff8fc0" />
                <polygon points="0,18 8,18 4,26" fill="#f1d9b5" />
                <polygon points="2.6,22.6 5.4,22.6 4,26" fill="#3a2d26" />
              </g>
            </g>
          )}
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
