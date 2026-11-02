// Small flat illustrations for the Services cards, in the studio palette.
// Each is a 320×150 SVG; colours come from CSS variables so they follow the theme.

const C = {
  frame: '#2a2019',
  panel: '#3a2c22',
  line: 'rgba(255,236,220,0.18)',
  cream: '#f4e9dc',
  amber: '#ff9a3c',
  pink: '#ff6fae',
  teal: '#5fc7b8',
}

// A browser window with a landing page: hero, headline, button and a row of cards.
function Website() {
  return (
    <svg viewBox="0 0 320 150" role="img" aria-label="Illustration of a website in a browser window">
      <rect x="40" y="16" width="240" height="122" rx="10" fill={C.frame} stroke={C.line} />
      <circle cx="54" cy="29" r="3" fill="#ff5f57" />
      <circle cx="64" cy="29" r="3" fill="#febc2e" />
      <circle cx="74" cy="29" r="3" fill="#28c840" />
      <rect x="92" y="25" width="120" height="8" rx="4" fill={C.panel} />
      <g className="art-float">
        <rect x="54" y="44" width="212" height="46" rx="6" fill="url(#webHero)" />
        <rect x="64" y="54" width="92" height="8" rx="3" fill={C.cream} />
        <rect x="64" y="66" width="64" height="5" rx="2.5" fill="rgba(255,255,255,0.6)" />
        <rect x="64" y="76" width="34" height="8" rx="4" fill={C.frame} />
        <circle cx="232" cy="67" r="15" fill="rgba(255,255,255,0.25)" />
      </g>
      {[54, 126, 198].map((x, i) => (
        <g key={x}>
          <rect x={x} y="98" width="68" height="32" rx="5" fill={C.panel} />
          <rect x={x + 8} y="106" width="18" height="18" rx="4" fill={[C.amber, C.pink, C.teal][i]} opacity="0.85" />
          <rect x={x + 32} y="108" width="28" height="4" rx="2" fill={C.line} />
          <rect x={x + 32} y="116" width="20" height="4" rx="2" fill={C.line} />
        </g>
      ))}
      <defs>
        <linearGradient id="webHero" x1="0" x2="1">
          <stop offset="0" stopColor={C.amber} />
          <stop offset="1" stopColor={C.pink} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// A phone with an app screen, next to a small tablet showing the web version.
function Apps() {
  return (
    <svg viewBox="0 0 320 150" role="img" aria-label="Illustration of a mobile app and a web app">
      {/* tablet / web app */}
      <rect x="128" y="22" width="150" height="108" rx="10" fill={C.frame} stroke={C.line} />
      <rect x="138" y="32" width="34" height="88" rx="5" fill={C.panel} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="144" y={40 + i * 14} width="22" height="5" rx="2.5" fill={i === 1 ? C.amber : C.line} />
      ))}
      <rect x="180" y="32" width="88" height="40" rx="5" fill={C.panel} />
      <polyline points="186,64 200,54 214,58 228,44 242,50 260,38" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="180" y="78" width="42" height="42" rx="5" fill={C.panel} />
      <rect x="226" y="78" width="42" height="42" rx="5" fill={C.panel} />
      <circle cx="201" cy="99" r="12" fill="none" stroke={C.pink} strokeWidth="5" strokeDasharray="50 26" />
      <rect x="234" y="88" width="26" height="5" rx="2.5" fill={C.line} />
      <rect x="234" y="98" width="18" height="5" rx="2.5" fill={C.line} />
      {/* phone / mobile app */}
      <g className="art-float">
        <rect x="52" y="14" width="66" height="124" rx="13" fill={C.frame} stroke={C.line} strokeWidth="1.5" />
        <rect x="58" y="22" width="54" height="108" rx="8" fill="url(#appScreen)" />
        <rect x="76" y="17" width="18" height="3" rx="1.5" fill={C.panel} />
        <circle cx="85" cy="44" r="10" fill="rgba(255,255,255,0.85)" />
        <rect x="66" y="62" width="38" height="5" rx="2.5" fill={C.cream} />
        <rect x="70" y="71" width="30" height="4" rx="2" fill="rgba(255,255,255,0.55)" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="64" y={84 + i * 13} width="42" height="9" rx="4.5" fill="rgba(255,255,255,0.22)" />
        ))}
      </g>
      <defs>
        <linearGradient id="appScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.pink} />
          <stop offset="1" stopColor={C.amber} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Scattered tools (sheets, mail, chat) flowing into one tidy custom dashboard.
function Software() {
  const tools = [
    { y: 26, color: C.teal, glyph: 'grid' },
    { y: 64, color: C.amber, glyph: 'mail' },
    { y: 102, color: C.pink, glyph: 'chat' },
  ]
  return (
    <svg viewBox="0 0 320 150" role="img" aria-label="Illustration of separate tools connected into one custom dashboard">
      {tools.map(({ y, color, glyph }) => (
        <g key={y}>
          <rect x="30" y={y} width="40" height="26" rx="6" fill={C.panel} stroke={C.line} />
          {glyph === 'grid' && (
            <g stroke={color} strokeWidth="1.6" fill="none">
              <rect x="40" y={y + 6} width="20" height="14" rx="1.5" />
              <line x1="40" y1={y + 13} x2="60" y2={y + 13} />
              <line x1="50" y1={y + 6} x2="50" y2={y + 20} />
            </g>
          )}
          {glyph === 'mail' && (
            <g stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round">
              <rect x="40" y={y + 6} width="20" height="14" rx="1.5" />
              <polyline points={`40,${y + 7} 50,${y + 14} 60,${y + 7}`} />
            </g>
          )}
          {glyph === 'chat' && (
            <path d={`M41 ${y + 7} h18 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 h-10 l-5 4 v-4 h-3 a2 2 0 0 1 -2 -2 v-8 a2 2 0 0 1 2 -2z`} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
          )}
          {/* connector into the dashboard */}
          <path d={`M70 ${y + 13} C 110 ${y + 13}, 110 75, 150 75`} fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 5" className="art-flow" opacity="0.8" />
        </g>
      ))}
      <g className="art-float">
        <rect x="150" y="18" width="140" height="114" rx="10" fill={C.frame} stroke={C.line} />
        <rect x="160" y="28" width="50" height="6" rx="3" fill={C.cream} />
        <rect x="160" y="42" width="58" height="36" rx="5" fill={C.panel} />
        <rect x="222" y="42" width="58" height="36" rx="5" fill={C.panel} />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={168 + i * 11} y={70 - [12, 20, 16, 24][i]} width="7" height={[12, 20, 16, 24][i]} rx="2" fill={C.amber} />
        ))}
        <circle cx="251" cy="60" r="11" fill="none" stroke={C.teal} strokeWidth="5" strokeDasharray="44 26" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="160" y={86 + i * 14} width="120" height="10" rx="3" fill={C.panel} />
            <circle cx="167" cy={91 + i * 14} r="2.5" fill={[C.teal, C.amber, C.pink][i]} />
            <rect x="174" y={89 + i * 14} width={[60, 44, 70][i]} height="4" rx="2" fill={C.line} />
          </g>
        ))}
      </g>
    </svg>
  )
}

// Your documents and data feeding an AI model, which answers inside your own app.
function Ai() {
  const sources = [
    { y: 24, color: C.amber, glyph: 'doc' },
    { y: 62, color: C.teal, glyph: 'data' },
    { y: 100, color: C.pink, glyph: 'api' },
  ]
  const spark = (cx, cy, r) =>
    `M${cx} ${cy - r} C ${cx + r * 0.18} ${cy - r * 0.18}, ${cx + r * 0.18} ${cy - r * 0.18}, ${cx + r} ${cy} C ${cx + r * 0.18} ${cy + r * 0.18}, ${cx + r * 0.18} ${cy + r * 0.18}, ${cx} ${cy + r} C ${cx - r * 0.18} ${cy + r * 0.18}, ${cx - r * 0.18} ${cy + r * 0.18}, ${cx - r} ${cy} C ${cx - r * 0.18} ${cy - r * 0.18}, ${cx - r * 0.18} ${cy - r * 0.18}, ${cx} ${cy - r}Z`
  return (
    <svg viewBox="0 0 320 150" role="img" aria-label="Illustration of documents and data flowing through an AI model into an app">
      {sources.map(({ y, color, glyph }) => (
        <g key={y}>
          <rect x="18" y={y} width="34" height="26" rx="6" fill={C.panel} stroke={C.line} />
          {glyph === 'doc' && (
            <g stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round">
              <path d={`M29 ${y + 5} h9 l5 5 v12 h-14z`} />
              <line x1="32" y1={y + 15} x2="40" y2={y + 15} />
              <line x1="32" y1={y + 19} x2="38" y2={y + 19} />
            </g>
          )}
          {glyph === 'data' && (
            <g stroke={color} strokeWidth="1.6" fill="none">
              <ellipse cx="35" cy={y + 8} rx="8" ry="3" />
              <path d={`M27 ${y + 8} v10 c0 4 16 4 16 0 v-10`} />
              <path d={`M27 ${y + 13} c0 4 16 4 16 0`} />
            </g>
          )}
          {glyph === 'api' && (
            <g stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={`31,${y + 8} 26,${y + 13} 31,${y + 18}`} />
              <polyline points={`39,${y + 8} 44,${y + 13} 39,${y + 18}`} />
            </g>
          )}
          <path d={`M52 ${y + 13} C 76 ${y + 13}, 76 75, 98 75`} fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 5" className="art-flow" opacity="0.8" />
        </g>
      ))}
      {/* the model */}
      <rect x="98" y="51" width="48" height="48" rx="14" fill="url(#aiCore)" />
      <path d={spark(122, 75, 13)} fill={C.cream} />
      <path d={spark(135, 62, 4)} fill="rgba(255,255,255,0.8)" />
      <path d="M146 75 H 168" stroke={C.cream} strokeWidth="2" strokeDasharray="4 5" className="art-flow" opacity="0.6" />
      {/* the app, answering */}
      <g className="art-float">
        <rect x="168" y="18" width="134" height="114" rx="10" fill={C.frame} stroke={C.line} />
        <rect x="178" y="28" width="44" height="6" rx="3" fill={C.cream} />
        <rect x="236" y="44" width="56" height="16" rx="8" fill={C.panel} />
        <rect x="244" y="50" width="38" height="4" rx="2" fill={C.line} />
        <rect x="178" y="68" width="100" height="36" rx="9" fill="rgba(255,111,174,0.16)" stroke="rgba(255,111,174,0.4)" />
        <path d={spark(189, 79, 5)} fill={C.pink} />
        <rect x="198" y="76" width="68" height="4" rx="2" fill={C.cream} opacity="0.8" />
        <rect x="186" y="86" width="78" height="4" rx="2" fill={C.line} />
        <rect x="186" y="94" width="54" height="4" rx="2" fill={C.line} />
        <rect x="178" y="112" width="114" height="12" rx="6" fill={C.panel} />
        <circle cx="284" cy="118" r="3" fill={C.amber} />
      </g>
      <defs>
        <linearGradient id="aiCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.amber} />
          <stop offset="1" stopColor={C.pink} />
        </linearGradient>
      </defs>
    </svg>
  )
}

export const SERVICE_ART = { website: Website, apps: Apps, software: Software, ai: Ai }
