// Line icons for the Process steps (24×24, currentColor), one per step.

const Svg = ({ children, size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)

export const PROCESS_ICONS = {
  // two speech bubbles: a conversation
  talk: (p) => (
    <Svg {...p}>
      <path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-4-3h-3" />
    </Svg>
  ),
  // a checklist on a clipboard
  plan: (p) => (
    <Svg {...p}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M8.5 10l1.5 1.5 3-3M8.5 16l1.5 1.5 3-3" />
    </Svg>
  ),
  // a pen nib crossed with code brackets: design + development
  build: (p) => (
    <Svg {...p}>
      <path d="M7 8l-4 4 4 4M17 8l4 4-4 4" />
      <path d="M13.5 5l-3 14" />
    </Svg>
  ),
  // a rocket
  launch: (p) => (
    <Svg {...p}>
      <path d="M12 15l-3-3c1.5-4.5 4.5-8 10-9-1 5.5-4.5 8.5-9 10" />
      <path d="M9 12l-3 .5L4 15l4 1M12 15l-.5 3L9 20l-1-4" />
      <circle cx="15" cy="9" r="1.5" />
    </Svg>
  ),
  // a heart in a hand-off loop: ongoing care
  support: (p) => (
    <Svg {...p}>
      <path d="M12 19s-7-4.3-7-9.3A3.7 3.7 0 0 1 12 7.6a3.7 3.7 0 0 1 7 2.1c0 5-7 9.3-7 9.3z" />
    </Svg>
  ),
}
