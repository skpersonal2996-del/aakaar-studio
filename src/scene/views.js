// Room is 12m wide (x -6..6), 10m deep (z -5..5), 4.2m tall. The front wall is left open for the camera.
export const ROOM = { W: 12, D: 10, H: 4.2 }

// Where the shared desk sits; people and laptops are placed relative to it.
export const DESK = [0.2, 0, 0.9]

// Back-wall layout, left to right.
export const LAYOUT = {
  curtain: [-6, -3.55], // behind the sofa
  art: -2.65, // framed print above the sofa end
  shelf: -0.95, // tall open shelf
  poster: -0.15, // "Good design" poster
  slats: [0.2, 3.6], // slat wall with the backlit sign
  pegboard: 4.85, // ID-card wall
}

export const INTRO = { pos: [0.6, 3.4, 13.5], target: [0.3, 1.5, -2.0] }
export const HOME = { pos: [0.3, 1.8, 6.0], target: [0.3, 1.6, 2.8] }

// Camera framing for each section: where the camera goes and what it looks at.
export const VIEWS = {
  projects: { pos: [2.55, 1.6, 2.4], target: [1.05, 0.95, 0.75] },
  story: { pos: [-2.6, 1.85, 3.2], target: [-5.8, 1.55, 1.6] }, // the bookshelf
  services: { pos: [-2.25, 1.65, 1.75], target: [-0.88, 0.92, 1.0] }, // over Vinay's shoulder onto his laptop
  process: { pos: [-1.6, 1.85, 0.4], target: [-4.1, 0.75, -3.6] }, // the couch
  about: { pos: [4.6, 2.05, -1.45], target: [4.85, 2.1, -4.9] }, // the founders' ID wall
  contact: { pos: [0.25, 1.4, 2.35], target: [-0.1, 0.78, 1.32] },
}

// Gentle close-ups that don't open a panel.
export const PEEKS = {
  developer: { pos: [0.55, 1.7, 3.4], target: [-1.15, 1.1, 1.0] },
  designer: { pos: [-0.15, 1.7, 3.3], target: [1.55, 1.1, 0.78] },
}

// Glowing markers, one per section.
export const HOTSPOTS = {
  projects: [1.2, 1.22, 0.78],
  story: [-5.45, 3.35, 1.6], // bookshelf
  services: [-0.88, 1.2, 1.05], // above Vinay's laptop
  process: [-3.95, 1.05, -3.0, 1.35], // over the coffee table, mid-couch; 4th value = size boost
  about: [4.85, 3.12, -4.75], // founders' ID wall
  contact: [-0.1, 1.0, 1.32],
}
