// The studio is the first site's room rebuilt and baked in Blender (blender/build_spacious_room.py):
// 12 m wide (x -6..6), 10 m deep (z -5..5), 4.2 m tall, with the front wall left open for the camera.
// It is baked in three moods, each in public/studio/<room>/; pick one with ?room=… (it is remembered).
// Blender (x, y, z) = Three (x, -z, y).
export const ROOMS = ['spacious-dark', 'spacious-warm', 'spacious-cream']
export const ROOM_LABELS = { 'spacious-dark': 'Big · dark', 'spacious-warm': 'Big · warm', 'spacious-cream': 'Big · cream' }
const asked = new URLSearchParams(window.location.search).get('room')
const stored = (() => { try { return localStorage.getItem('room') } catch { return null } })()
export const ROOM_ID = [asked, stored].find((r) => ROOMS.includes(r)) || ROOMS[0]
try { localStorage.setItem('room', ROOM_ID) } catch { /* private mode: the URL still works */ }
export const ROOM = { X0: -6, X1: 6, Z0: -5, Z1: 5, H: 4.2 }

// Where the shared desk sits; people and laptops are placed relative to it.
export const DESK = [0.2, 0, 0.9]

// Live (unbaked) features on the walls.
export const SIGN = { position: [1.9, 2.78, -4.87], size: [2.95, 1.3] } // backlit sign on the slat wall
export const WINDOW = { x: 5.98, y: 2.05, z: -2.0, width: 2.4, height: 1.8 } // city view, right wall

// Where each character pair sits (blender/place_characters.py → generated/seats-*.json). Characters,
// chairs and laptops are live, not baked, because each pair sits at its own distance from the desk.
// `person` is the hip point on the floor. The developer faces +x and the designer -x, each turned 20°
// towards the camera; rotations are about y. Laptops are scaled to each cast's hands.
const seat = (person, rotation, chair, chairRotation, laptop, laptopRotation, laptopScale) =>
  ({ person, rotation, chair, chairRotation, laptop, laptopRotation, laptopScale })
export const SEATS = {
  classic: {
    developer: seat([-1.343, 0, 0.897], 1.222, [-1.372, 0, 0.887], 1.222, [-0.924, 0.765, 1.05], -1.92, 1.15),
    designer: seat([1.75, 0, 0.625], -1.222, [1.778, 0, 0.615], -1.222, [1.324, 0.765, 0.78], 1.92, 1.15),
  },
  chibi: {
    developer: seat([-1.298, 0, 0.917], 1.222, [-1.326, 0, 0.906], 1.222, [-0.932, 0.765, 1.05], -1.92, 1.35),
    designer: seat([1.702, 0, 0.645], -1.222, [1.73, 0, 0.635], -1.222, [1.332, 0.765, 0.78], 1.92, 1.35),
  },
}

// The first site's wide view from beyond the open front (the hero camera in lookdev_spacious.py).
export const INTRO = { pos: [0.6, 3.4, 13.5], target: [0.3, 1.5, -2.0] }
export const HOME = { pos: [0.3, 1.8, 6.0], target: [0.3, 1.6, 2.8] }

// Camera framing for each section: where the camera goes and what it looks at.
export const VIEWS = {
  projects: { pos: [2.55, 1.6, 2.4], target: [1.33, 0.95, 0.78] },
  story: { pos: [-2.6, 1.85, 3.2], target: [-5.8, 1.55, 1.6] }, // the built-in bookshelf, left wall
  services: { pos: [-2.25, 1.65, 1.75], target: [-0.93, 0.92, 1.05] }, // over Vinay's shoulder onto his laptop
  process: { pos: [-1.6, 1.85, 0.4], target: [-4.1, 0.75, -3.6] }, // the sofa in the back-left corner
  about: { pos: [4.6, 2.05, -1.45], target: [4.85, 2.1, -4.9] }, // the founders' ID wall, back wall
  contact: { pos: [0.25, 1.4, 2.35], target: [-0.1, 0.78, 1.32] },
}

// Gentle close-ups that don't open a panel.
export const PEEKS = {
  developer: { pos: [0.55, 1.7, 3.4], target: [-1.15, 1.1, 1.0] },
  designer: { pos: [-0.15, 1.7, 3.3], target: [1.55, 1.1, 0.78] },
}

// Glowing markers, one per section; a 4th value is a size boost.
export const HOTSPOTS = {
  projects: [1.33, 1.22, 0.78],
  story: [-5.45, 3.35, 1.6], // bookshelf
  services: [-0.93, 1.2, 1.05], // above Vinay's laptop
  process: [-3.95, 1.05, -3.0, 1.35], // over the coffee table
  about: [4.85, 3.12, -4.75], // founders' ID wall
  contact: [-0.1, 1.0, 1.32],
}

// Invisible click targets over baked furniture: [centre, size] in Three coordinates.
export const HIT_BOXES = {
  story: [[-5.79, 1.5, 1.85], [0.4, 3.0, 5.2]],
  process: [[-4.0, 0.45, -3.2], [4.0, 0.9, 3.4]],
  about: [[4.85, 2.2, -4.88], [1.6, 1.3, 0.12]],
  services: [[-0.93, 0.9, 1.05], [0.32, 0.28, 0.4]], // Vinay's laptop
  projects: [[1.33, 0.9, 0.78], [0.32, 0.28, 0.4]], // Shruti's laptop
  contact: [[-0.1, 0.79, 1.32], [0.14, 0.05, 0.22]], // phone on the desk
}
