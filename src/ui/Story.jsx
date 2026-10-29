import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { STORY } from '../content'

// "Our story": a pencil line draws itself down the middle as the panel scrolls, and the story
// unfolds beside it one small moment at a time, each with an emoji on the line for the feeling.

// A slightly wobbly vertical line, like it was drawn by hand.
function pencilPath(height) {
  const pts = []
  for (let y = 0; y <= height; y += 36) {
    const x = 20 + Math.sin(y * 0.021) * 3.2 + Math.sin(y * 0.057 + 1.3) * 1.6
    pts.push(`${x.toFixed(1)},${y}`)
  }
  return 'M' + pts.join(' L')
}

export function Story() {
  const root = useRef()
  const [height, setHeight] = useState(0)
  const [progress, setProgress] = useState(0) // how far down the line is drawn, in px
  const [shown, setShown] = useState(1) // how many beats are revealed

  // track the story's height (fonts and wrapping can change it)
  useLayoutEffect(() => {
    const el = root.current
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // draw the line and reveal beats as the panel scrolls
  useEffect(() => {
    const el = root.current
    const scroller = el.closest('.panel__scroll')
    if (!scroller) return
    const update = () => {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      // the "pencil tip" sits about two thirds down the visible area
      const tip = Math.max(0, Math.min(el.offsetHeight, scroller.clientHeight * 0.68 - top))
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      setProgress(atEnd ? el.offsetHeight : tip)
      const beats = el.querySelectorAll('.beat')
      let n = 0
      beats.forEach((b) => {
        if (b.offsetTop + 20 < (atEnd ? Infinity : tip)) n++
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
  }, [height])

  const d = useMemo(() => (height ? pencilPath(height) : ''), [height])
  const done = height > 0 && progress >= height - 2

  return (
    <div className="tale" ref={root}>
      {height > 0 && (
        <svg className="tale__line" width="40" height={height} viewBox={`0 0 40 ${height}`} aria-hidden>
          {/* faint guide, then the drawn graphite stroke on top */}
          <path d={d} className="tale__guide" />
          <path d={d} className="tale__stroke" pathLength="1" style={{ strokeDashoffset: 1 - progress / height }} />
          {!done && (
            <g transform={`translate(${20 + Math.sin(progress * 0.021) * 3.2}, ${progress})`} className="tale__pencil">
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
