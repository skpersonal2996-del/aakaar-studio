// All site copy lives here. Names, clients and links are placeholders to swap for the real ones.

// Files in public/, resolved against the deploy base (/ on Vercel, /aakaar-studio/ on GitHub Pages).
const asset = (path) => import.meta.env.BASE_URL + path

export const STUDIO = {
  name: 'aakaar',
  tagline: 'Design • Develop • Together',
  kind: 'Digital product studio',
  motto: 'Two people · One vision',  email: 'hello@aakaar.studio',
}

export const NAV = ['projects', 'story', 'services', 'process', 'about', 'contact']

export const SECTIONS = {
  projects: {
    index: '01',
    label: 'Projects',
    object: 'Shruti’s laptop',
    title: 'Selected work',
    intro: 'Products we have shaped from first sketch to shipped code. Small team, full ownership from start to finish.',
  },
  story: {
    index: '02',
    label: 'Our story',
    object: 'The bookshelf',
    title: 'Before the studio, there was a bookshelf.',
    // no intro: the story itself is the content
  },
  services: {
    index: '03',
    label: 'Services',
    object: 'Vinay’s laptop',
    title: 'So, what can we make?',
    intro: 'From your first online presence to software that makes work a whole lot easier.',
  },
  process: {
    index: '04',
    label: 'Process',
    object: 'The couch',
    title: 'Here’s what working with us looks like.',
    intro: 'Just a few thoughtful steps from idea to launch.',
  },
  about: {
    index: '05',
    label: 'About',
    object: 'The ID wall',
    title: 'Meet the founders',
    intro:
      'Aakaar (आकार) means “shape”. We are a digital product studio of two: a designer and a developer who take ideas from a rough sketch to a product people use, and share one very large desk while doing it.',
  },
  contact: {
    index: '06',
    label: 'Contact',
    object: 'The phone',
    title: 'Say hello',
    intro:
      'Have a product that needs shape? Big idea, small improvement, or something you’re still trying to figure out. We’re all ears.',
  },
}

// The couch: how a project with us unfolds, step by step.
// short: one-word label for the journey strip · icon: see src/ui/ProcessIcons.jsx · tags: scannable takeaways
export const PROCESS = [
  {
    short: 'Talk',
    icon: 'talk',
    title: 'We talk it through.',
    text: 'We get to know your business, the problem you’re solving, and what success could look like.',
    tags: ['Your business', 'The problem', 'What success looks like'],
  },
  {
    short: 'Plan',
    icon: 'plan',
    title: 'We figure out the plan.',
    text: 'We agree on the right approach, what’s included, and what it’ll take to get there.',
    tags: ['Approach', 'Scope', 'Timeline'],
  },
  {
    short: 'Build',
    icon: 'build',
    title: 'We design and build.',
    text: 'We bring design and development together, using AI tools where they help us explore ideas, test possibilities, and work more efficiently. AI helps us work smarter. Human judgment still leads the way.',
    tags: ['Design + code together', 'Assisted by AI, led by people'],
  },
  {
    short: 'Launch',
    icon: 'launch',
    title: 'We get it out into the world.',
    text: 'We test, launch, and hand over the product so you know what comes next.',
    tags: ['Test', 'Launch', 'Handover'],
  },
  {
    short: 'Support',
    icon: 'support',
    title: 'And we’re here for what’s next.',
    text: 'Need a hand with maintenance, improvements, or figuring out the next step? Let’s talk. We’re happy to keep helping beyond launch, with ongoing support agreed around your needs.',
    tags: ['Maintenance', 'Improvements', 'Ongoing support'],
  },
]

// Selected work. tags give the gist at a glance; url opens the live product (no url shows "Coming soon").
// impact is optional and shows as a highlighted callout.
export const PROJECTS = [
  {
    name: 'Bridge',
    title: 'Making everyday operations easier.',
    image: asset('projects/bridge.webp'),
    alt: 'A driving school office with learner cars, cones, a checklist and a car key',
    tags: ['Business software', 'Workflow automation', 'Product design'],
    text: 'An admin platform for driving schools that turns manual paperwork into simple, automated workflows anyone on the team can use.',
    impact: 'Admin time down 60%, with business data that’s easy to track.',
    url: 'https://bridgedrive.in/',
  },
  {
    name: 'PrimeChat',
    title: 'Turning donations into moments worth celebrating.',
    image: asset('projects/primechat.webp'),
    alt: 'PrimeChat overlay in OBS showing a donation alert, a goal bar and recent supporters over a game',
    tags: ['Live streaming', 'Creator tools', 'OBS overlays'],
    text: 'Custom donation pages and live stream alerts that help creators thank supporters live and keep them part of the show.',
    url: 'https://dev.primechat.live/',
  },
  {
    name: 'DocFit',
    title: 'Documents that format themselves.',
    image: asset('projects/docfit.webp'),
    alt: 'A spreadsheet and a Word template flowing through an AI step into a stack of formatted documents',
    tags: ['AI', 'Document automation', 'In progress'],
    text: 'Spreadsheet data in, hundreds of perfectly formatted documents out, with AI keeping every template’s layout intact.',
  },
]

// The bookshelf: our story, one small moment at a time. Each beat sits beside a pencil line
// that draws itself as you scroll; the emoji on the line carries the feeling of that moment.
// hand: set the line in handwriting, for the moments worth pausing on.
export const STORY = [
  { emoji: '🎓', text: 'Back in college, we heard that successful people read a lot.' },
  { emoji: '🤔', text: 'So we thought, why not start early?', hand: true },
  { emoji: '💸', text: 'Books weren’t exactly in a student’s budget…' },
  { emoji: '🤝', text: '…so we came up with a plan: you’d buy two, I’d buy two, and together, we’d have four.', hand: true },
  { emoji: '📚', text: 'And just like that, our little collection began.' },
  { emoji: '🔍', text: 'We started with self help books, looking for answers, ideas, and maybe a shortcut to figuring life out.' },
  { emoji: '😅', text: 'We didn’t find all the answers, of course.', hand: true },
  { emoji: '💡', text: 'But we found something better: a habit of staying curious, sharing what we learned, and growing together.' },
  { emoji: '😄', text: 'Looking back, it’s funny how a small decision to split the cost of four books…' },
  { emoji: '🧡', text: '…became a partnership that has lasted through college projects, different careers, and now, our own studio.', hand: true },
]

// art: which illustration sits on the card (see src/ui/ServiceArt.jsx)
export const SERVICES = [
  { name: 'Websites & landing pages', art: 'website', text: 'Give your business a home online, tell your story, and make it easier for the right people to find you.' },
  { name: 'Mobile & web apps', art: 'apps', text: 'Turn an idea into a useful experience people can actually use.' },
  { name: 'Custom software & SaaS', art: 'software', text: 'Replace clunky workflows and disconnected tools with software built around how your business works.' },
]

// The two founders: shown as photo ID cards on the wall and in the About panel.
export const TEAM = [
  {
    name: 'Shruti',
    role: 'Product designer · Cofounder',
    card: 'Designer',
    color: '#7b3fe4',
    photo: asset('team/shruti.webp'),
    note: 'Understands the human side of every product: researching, shaping flows and crafting interfaces people love to use, like the one you’re exploring right now.',
  },
  {
    name: 'Vinay',
    role: 'Developer · Cofounder',
    card: 'Developer',
    color: '#2a5bd7',
    photo: asset('team/vinay.webp'),
    note: 'The backbone of everything we ship. Vinay takes on the complex parts: system architecture, clean and scalable code from front end to back end, integrations, performance and security. The result is products that feel fast, reliable and built to grow.',
  },
]

// Hover introduction for the developer sitting at the desk.
export const DEVELOPER = {
  title: 'Here’s Vinay, the developer',
  line: 'The backbone of every product and solution we build.',
}

// Hover introduction for the designer.
export const DESIGNER = {
  title: 'Here’s Shruti, the designer',
  line: 'Shaping designs into experiences people love to use.',
}

// "The studio" paragraphs in the About panel.
export const ABOUT_STUDIO = [
  'We started aakaar to build products the way we always wanted to: design and code in the same room, from the very first conversation.',
  'You work directly with the two people doing the work. No handoffs, no layers. We help you figure out what is worth building, then design it, develop it and ship it together.',
]

export const PRINCIPLES = ['Small team, direct line', 'Design and code in the same room', 'Ship, learn, refine']

// Icon buttons in the Contact panel — replace '#' with the real profile links.
export const SOCIALS = [
  ['Instagram', '#'],
  ['LinkedIn', '#'],
  ['GitHub', '#'],
]
