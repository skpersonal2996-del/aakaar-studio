import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { SERVICE_ART } from './ServiceArt'
import { PROCESS_ICONS } from './ProcessIcons'
import { Story } from './Story'
import { ABOUT_STUDIO, PRINCIPLES, PROCESS, PROJECTS, SECTIONS, SERVICES, SOCIALS, STUDIO, TEAM } from '../content'

function Projects() {
  return (
    <div className="list">
      {PROJECTS.map((p, i) => (
        <article key={p.name} className="project">
          <span className="project__label mono">
            0{i + 1} / {p.name}
          </span>
          <h3 className="project__title">{p.title}</h3>
          <div className="project__thumb">
            <img src={p.image} alt={p.alt} loading="lazy" />
          </div>
          <p>{p.text}</p>
          {p.impact && (
            <div className="project__impact">
              <span className="mono">The impact</span>
              <p>{p.impact}</p>
            </div>
          )}
        </article>
      ))}
    </div>
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
          onClick={() => {
            navigator.clipboard?.writeText(STUDIO.email)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}>
          {copied ? 'Copied ✓' : 'Copy email'}
        </button>
      </div>
      <h4 className="mono label">Elsewhere</h4>
      <div className="socials">
        {SOCIALS.map(([n, href]) => (
          <a key={n} href={href} target="_blank" rel="noreferrer" aria-label={n} title={n}>
            {SOCIAL_ICONS[n]}
          </a>
        ))}
      </div>
    </>
  )
}

const BODIES = { projects: Projects, story: Story, services: Services, process: Process, about: About, contact: Contact }

export function Panel() {
  const active = useStore((s) => s.active)
  const close = useStore((s) => s.close)
  // keep the last section mounted while the panel slides out
  const [shown, setShown] = useState(active)
  const body = useRef()
  useEffect(() => {
    if (active) setShown(active)
    if (body.current) body.current.scrollTop = 0
  }, [active])
  const s = shown && SECTIONS[shown]
  const Body = shown && BODIES[shown]
  return (
    <aside className={`panel ${active ? 'is-open' : ''}`} aria-hidden={!active}>
      {s && (
        <div className="panel__scroll" ref={body} key={shown}>
          <div className="panel__head">
            <button className="back mono" onClick={close}>
              ← Back to studio
            </button>
            <span className="mono muted">
              {s.index} / {s.object}
            </span>
          </div>
          <p className="mono kicker">{s.label}</p>
          <h2>{s.title}</h2>
          {s.intro ? <p className="intro">{s.intro}</p> : <div className="intro-gap" />}
          <Body />
        </div>
      )}
    </aside>
  )
}
