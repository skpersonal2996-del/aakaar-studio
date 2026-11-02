import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { SERVICE_ART } from './ServiceArt'
import { PROCESS_ICONS } from './ProcessIcons'
import { Story } from './Story'
import { ABOUT_STUDIO, PRINCIPLES, PROCESS, PROJECTS, SECTIONS, SERVICES, SOCIALS, STUDIO, TEAM } from '../content'

// A round "Visit" cursor that trails the mouse over live project images.
function useVisitCursor() {
  const dot = useRef()
  useEffect(() => {
    const el = dot.current
    let x = 0
    let y = 0
    let cx = 0
    let cy = 0
    let raf = 0
    const step = () => {
      cx += (x - cx) * 0.25
      cy += (y - cy) * 0.25
      el.style.transform = `translate(${cx}px, ${cy}px)`
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(step) : 0
    }
    const move = (e) => {
      const over = e.target.closest?.('.project--live .project__thumb')
      el.classList.toggle('is-on', !!over)
      if (!over) return
      if (!el.dataset.placed) {
        cx = e.clientX // appear right under the pointer rather than sliding in from the corner
        cy = e.clientY
        el.dataset.placed = '1'
      }
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(step)
    }
    const leave = () => el.classList.remove('is-on')
    // scrolling moves the images under a still pointer, so check what's under it again
    const recheck = () => {
      const under = document.elementFromPoint(x, y)
      el.classList.toggle('is-on', !!under?.closest('.project--live .project__thumb'))
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', recheck, { capture: true, passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', recheck, { capture: true })
      document.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [])
  return dot
}

// The list: one compact card per project. Opening one widens the panel into its page, and the camera
// moves in on Shruti's laptop, which shows it; hovering a card puts it on her screen first.
function Projects() {
  const cursor = useVisitCursor()
  const showcase = useStore((s) => s.showcase)
  const setShowcase = useStore((s) => s.setShowcase)
  const setPreview = useStore((s) => s.setPreview)
  return (
    <>
      {/* on the body, since the sliding panel's transform would offset a fixed element */}
      {createPortal(
        <span className="visit-cursor mono" ref={cursor} aria-hidden>
          <span>Visit</span>
        </span>,
        document.body,
      )}
      {showcase === null ? (
        <div className="index" onPointerLeave={() => setPreview(null)}>
          {PROJECTS.map((p, i) => (
            <button key={p.name} className="pcard" onClick={() => { setPreview(null); setShowcase(i) }}
              onPointerEnter={() => setPreview(i)} onFocus={() => setPreview(i)} onBlur={() => setPreview(null)}>
              <span className="pcard__thumb"><img src={p.image} alt="" loading="lazy" /></span>
              <span className="pcard__body">
                <span className="project__label mono">0{i + 1} / {p.name}</span>
                <span className="pcard__title">{p.title}</span>
                <span className="pcard__meta mono">{p.url ? <><i className="pcard__live" /> Live</> : 'In progress'} · {p.tags[0]}</span>
              </span>
              <span className="pcard__arrow" aria-hidden>→</span>
            </button>
          ))}
        </div>
      ) : (
        <ProjectPage index={showcase} />
      )}
    </>
  )
}

function ProjectPage({ index }) {
  const p = PROJECTS[index]
  const setShowcase = useStore((s) => s.setShowcase)
  const next = (index + 1) % PROJECTS.length
  const Thumb = p.url ? 'a' : 'div'
  const link = p.url ? { href: p.url, target: '_blank', rel: 'noreferrer' } : {}
  return (
    <article className={`project project--page ${p.url ? 'project--live' : 'project--soon'}`} key={p.name}>
      <span className="project__label mono">0{index + 1} / {p.name}</span>
      <h2 className="project__title project__title--big">{p.title}</h2>
      <Thumb className="project__thumb" {...link}>
        <img src={p.image} alt={p.alt} />
        {!p.url && <span className="project__cta mono">Coming soon</span>}
      </Thumb>
      <div className="project__cols">
        <div>
          <p>{p.text}</p>
          <div className="project__tags">
            {p.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        {p.impact && (
          <div className="project__impact">
            <span className="mono">The impact</span>
            <p>{p.impact}</p>
          </div>
        )}
      </div>
      <div className="project__foot">
        {p.url && (
          <a className="btn btn--primary" href={p.url} target="_blank" rel="noreferrer">
            Visit {p.name} ↗
          </a>
        )}
        <button className="btn" onClick={() => setShowcase(next)}>
          Next: {PROJECTS[next].name} →
        </button>
      </div>
    </article>
  )
}

function Services() {
  return (
    <ul className="services">
      {SERVICES.map(({ name, text, art }, i) => {
        const Art = SERVICE_ART[art]
        return (
          <li key={name} className="service">
            <span className="service__num mono">0{i + 1}</span>
            <h3 className="service__title">{name}</h3>
            <p>{text}</p>
            <div className="service__art">
              <Art />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Numbered steps joined by a thin line, so it reads as a journey from first chat to launch.
function Process() {
  return (
    <>
      {/* the whole journey at a glance */}
      <div className="journey" aria-hidden>
        {PROCESS.map(({ short, icon }, i) => {
          const Icon = PROCESS_ICONS[icon]
          return (
            <div key={short} className="journey__stop" style={{ '--i': i }}>
              <span className="journey__dot">
                <Icon size={18} />
              </span>
              <span className="journey__label mono">{short}</span>
            </div>
          )
        })}
      </div>

      <ol className="steps">
        {PROCESS.map(({ title, text, tags, icon }, i) => {
          const Icon = PROCESS_ICONS[icon]
          return (
            <li key={title} className="step">
              <span className="step__icon">
                <Icon />
              </span>
              <div>
                <span className="step__num mono">Step 0{i + 1}</span>
                <h3 className="step__title">{title}</h3>
                <div className="step__tags">
                  {tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <p>{text}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

function About() {
  return (
    <>
      <div className="team">
        {TEAM.map((m) => (
          <div key={m.name} className="member">
            <img className="member__photo" src={m.photo} alt={`${m.name}, ${m.card.toLowerCase()} at aakaar`} />
            <h3>{m.name}</h3>
            <p className="mono muted">{m.role}</p>
            <p>{m.note}</p>
          </div>
        ))}
      </div>
      <h4 className="mono label">The studio</h4>
      {ABOUT_STUDIO.map((p) => (
        <p key={p} className="studio-copy">
          {p}
        </p>
      ))}
      <h4 className="mono label">How we work</h4>
      <ul className="principles">
        {PRINCIPLES.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </>
  )
}

// Simple line icons for the social buttons (24×24, currentColor).
const icon = (children) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)
const SOCIAL_ICONS = {
  Instagram: icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>,
  ),
  LinkedIn: icon(
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5v6M8 7.5v.01M12 16.5v-3.5a2.5 2.5 0 0 1 5 0v3.5M12 10.5v6" />
    </>,
  ),
  GitHub: icon(
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
  ),
}

function Contact() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <>
      <a className="bigmail" href={`mailto:${STUDIO.email}`}>
        {STUDIO.email}
      </a>
      <div className="actions">
        <a className="btn btn--primary" href={`mailto:${STUDIO.email}?subject=New%20project`}>
          Send us an email
        </a>
        <button
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(STUDIO.email)
              setCopied(true)
              setCopyError(false)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => setCopied(false), 1600)
            } catch { setCopyError(true) }
          }}>
          {copied ? 'Copied ✓' : 'Copy email'}
        </button>
      </div>
      {copyError && <p role="status">Select the email address above to copy it, or open your email app.</p>}
      {SOCIALS.some(([, href]) => href && href !== '#') && <>
      <h4 className="mono label">Elsewhere</h4>
      <div className="socials">
        {SOCIALS.filter(([, href]) => href && href !== '#').map(([n, href]) => (
          <a key={n} href={href} target="_blank" rel="noreferrer" aria-label={n} title={n}>
            {SOCIAL_ICONS[n]}
          </a>
        ))}
      </div>
      </>}
    </>
  )
}

const BODIES = { projects: Projects, story: Story, services: Services, process: Process, about: About, contact: Contact }

export function Panel() {
  const active = useStore((s) => s.active)
  const entered = useStore((s) => s.entered)
  const close = useStore((s) => s.close)
  const showcase = useStore((s) => s.showcase)
  const setShowcase = useStore((s) => s.setShowcase)
  // keep the last section mounted while the panel slides out
  const [shown, setShown] = useState(active)
  const [modal, setModal] = useState(() => window.matchMedia('(max-width: 860px)').matches)
  const body = useRef()
  const dialog = useRef()
  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)')
    const change = () => setModal(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (active) setShown(active)
    if (body.current) body.current.scrollTop = 0
  }, [active, showcase])
  useEffect(() => {
    if (!active || !entered || !dialog.current) return
    const previous = document.activeElement
    const siblings = modal ? [...dialog.current.parentElement.children].filter((el) => el !== dialog.current).map((el) => [el, el.inert]) : []
    siblings.forEach(([el]) => { el.inert = true })
    dialog.current.querySelector('button')?.focus({ preventScroll: true })
    const trap = (e) => {
      if (!modal || e.key !== 'Tab') return
      const items = [...dialog.current.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter((el) => el.getClientRects().length)
      const first = items[0], last = items.at(-1)
      if (!dialog.current.contains(document.activeElement)) { e.preventDefault(); first?.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); siblings.forEach(([el, inert]) => { el.inert = inert }); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [active, shown, modal, entered])
  const s = shown && SECTIONS[shown]
  const Body = shown && BODIES[shown]
  const page = shown === 'projects' && showcase !== null // an opened project: a wider panel of its own
  return (
    <aside ref={dialog} className={`panel ${active && entered ? 'is-open' : ''} ${page ? 'panel--wide' : ''}`} role={modal ? 'dialog' : 'region'} aria-modal={active && entered && modal ? true : undefined} aria-label={s?.label || 'Studio section'} aria-hidden={!active || !entered} inert={active && entered ? undefined : ''}>
      {s && (
        <div className="panel__scroll" ref={body} key={shown}>
          <div className="panel__head">
            <button className="back mono" onClick={page ? () => setShowcase(null) : close}>
              {page ? '← All work' : '← Back to studio'}
            </button>
            <span className="mono muted">
              {s.index} / {s.object}
            </span>
          </div>
          {!page && (
            <>
              <p className="mono kicker">{s.label}</p>
              <h2>{s.title}</h2>
              {s.intro ? <p className="intro">{s.intro}</p> : <div className="intro-gap" />}
            </>
          )}
          <Body />
        </div>
      )}
    </aside>
  )
}
