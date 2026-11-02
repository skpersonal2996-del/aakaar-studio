import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { NAV, SECTIONS, STUDIO } from '../content'
import { Panel } from './Panel'
import { startMusic, stopMusic } from '../audio/lofi'
import { ROOM_ID, ROOM_LABELS, ROOMS } from '../scene/views'

function Loader({ ready }) {
  const entered = useStore((s) => s.entered)
  const enter = useStore((s) => s.enter)
  return (
    <div className={`loader ${entered ? 'is-gone' : ''}`}>
      <div className="loader__inner">
        <p className="mono loader__kicker">{STUDIO.kind}</p>
        <h1 className="loader__name">{STUDIO.name}</h1>
        <p className="mono loader__tag">{STUDIO.tagline}</p>
        {ready ? (
          <>
            <p className="mono loader__ask">Step inside</p>
            <div className="loader__choices">
              <button className="btn btn--primary" onClick={() => {
                  startMusic() // inside the click, so browsers allow audio to start
                  enter(true)
                }}>
                <span className="eq" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                With music
              </button>
              <button className="btn" onClick={() => enter(false)}>
                Without music
              </button>
            </div>
          </>
        ) : (
          // clearly busy while the 3D room is being prepared; same height as the buttons so nothing jumps
          <div className="loading" role="status" aria-live="polite">
            <p className="mono loader__ask">Getting the studio ready</p>
            <div className="loading__pill">
              <span className="spinner" aria-hidden />
              <span className="mono">Setting up the lights…</span>
            </div>
            <div className="loading__bar" aria-hidden>
              <i />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Overlay({ ready }) {
  const entered = useStore((s) => s.entered)
  const active = useStore((s) => s.active)
  const focus = useStore((s) => s.focus)
  const close = useStore((s) => s.close)
  const music = useStore((s) => s.music)
  const toggleMusic = useStore((s) => s.toggleMusic)
  const resetView = useStore((s) => s.resetView)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const cast = useStore((s) => s.cast)
  const toggleCast = useStore((s) => s.toggleCast)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    if (music) startMusic()
    else stopMusic()
  }, [music])
  const explore = () => focus(NAV[(NAV.indexOf(active) + 1) % NAV.length])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input,textarea,select,[contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') close()
      const n = Number(e.key)
      if (entered && n >= 1 && n <= NAV.length) focus(NAV[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entered, close, focus])

  useEffect(() => {
    if (!entered) return
    const off = () => setHint(false)
    const t = setTimeout(off, 9000)
    window.addEventListener('pointerdown', off, { once: true })
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', off) }
  }, [entered])

  return (
    <div className={`ui ${entered ? 'is-in' : ''} ${active ? 'is-focused' : ''}`}>
      <Loader ready={ready} />

      <header className="top">
        <button className="brandmark" onClick={close} aria-label="Back to the studio">
          <span className="brandmark__dot" />
          {STUDIO.name}
        </button>
        <div className="top__right">
        <button
          className={`chip chip--theme ${theme === 'night' ? 'is-night' : ''}`}
          onClick={toggleTheme}
          aria-pressed={theme === 'night'}
          aria-label={theme === 'night' ? 'Switch to the warm theme' : 'Switch to the night theme'}>
          <span className="theme-switch" aria-hidden>
            <span className="theme-switch__knob" />
          </span>
          <span className="chip__label">{theme === 'night' ? 'Night' : 'Warm'}</span>
        </button>
        <button
          className="chip chip--cast"
          onClick={toggleCast}
          aria-pressed={cast === 'chibi'}
          aria-label={cast === 'chibi' ? 'Switch to the classic characters' : 'Switch to the chibi characters'}
          title="Switch character style">
          <span className="chip__led" />
          <span className="chip__label">{cast === 'chibi' ? 'Chibi' : 'Classic'}</span>
        </button>
        {ROOMS.length > 1 && <button
          className="chip chip--cast"
          onClick={() => { // each room bakes its own scene, so switching reloads the page
            const next = ROOMS[(ROOMS.indexOf(ROOM_ID) + 1) % ROOMS.length]
            const query = new URLSearchParams(window.location.search); query.set('room', next)
            window.location.search = query.toString()
          }}
          aria-label={`Room: ${ROOM_LABELS[ROOM_ID]}. Switch to the ${ROOM_LABELS[ROOMS[(ROOMS.indexOf(ROOM_ID) + 1) % ROOMS.length]]} room`}
          title="Switch room">
          <span className="chip__led" />
          <span className="chip__label">{ROOM_LABELS[ROOM_ID]}</span>
        </button>}
        <button className={`chip chip--sound ${music ? 'is-on' : ''}`} onClick={() => {
            if (!music) startMusic()
            toggleMusic()
          }} aria-pressed={music} aria-label={music ? 'Turn music off' : 'Turn music on'}>
          <span className="eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="chip__label">{music ? 'Music on' : 'Music off'}</span>
        </button>
        <button className="chip" onClick={explore} title="Jump to the next part of the studio">
          <span className="chip__led" /> Explore
          <span className="chip__mouse" aria-hidden />
        </button>
        </div>
      </header>

      <div className="signature">
        <h2>{STUDIO.name.toUpperCase()}</h2>
        <p className="mono signature__kind">{STUDIO.kind}</p>
        <p className="mono signature__motto">
          <span className="dot" />
          {STUDIO.motto}
        </p>
      </div>

      <div className={`hint mono ${hint && !active ? '' : 'is-hidden'}`}>
        <span className="hint__drag" /> Drag to look around · click the glowing markers
      </div>

      <button className="reset" onClick={resetView} aria-label="Back to the default studio view" title="Back to the default view">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mono">Reset view</span>
      </button>

      <nav className="dock" aria-label="Sections" id="studio-navigation">
        {NAV.map((id) => (
          <button key={id} className={active === id ? 'is-active' : ''} aria-current={active === id ? 'page' : undefined} onClick={() => (active === id ? close() : focus(id))}>
            <span className="mono dock__index">{SECTIONS[id].index}</span>
            {SECTIONS[id].label}
          </button>
        ))}
      </nav>

      <Panel />
    </div>
  )
}
