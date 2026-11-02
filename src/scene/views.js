// The studio is the first site's room rebuilt and baked in Blender (blender/build_spacious_room.py):
// 12 m wide (x -6..6), 10 m deep (z -5..5), 4.2 m tall, with the front wall left open for the camera.
// It is baked in three moods, each in public/studio/<room>/; pick one with ?room=… (it is remembered).
// Blender (x, y, z) = Three (x, -z, y).
// The dark and cream rooms (public/studio/spacious-dark, -cream) are hidden until they are re-baked with the lower desk
// (build_furniture.py DESK_TOP); add them back here then. The first is the default.
export const ROOMS = ['spacious-warm']
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
    developer: seat([-1.275, 0, 0.922], 1.222, [-1.303, 0, 0.912], 1.222, [-0.924, 0.68, 1.05], -1.92, 1.15),
    designer: seat([1.685, 0, 0.649], -1.222, [1.713, 0, 0.638], -1.222, [1.324, 0.68, 0.78], 1.92, 1.15),
  },
  chibi: {
    developer: seat([-1.326, 0, 0.932], 1.222, [-1.354, 0, 0.922], 1.222, [-1.002, 0.68, 1.05], -1.92, 1.35),
    designer: seat([1.741, 0, 0.656], -1.222, [1.77, 0, 0.646], -1.222, [1.402, 0.68, 0.78], 1.92, 1.35),
  },
}

// The first site's wide view from beyond the open front (the hero camera in lookdev_spacious.py).
export const INTRO = { pos: [0.6, 3.4, 13.5], target: [0.3, 1.5, -2.0] }
export const HOME = { pos: [0.3, 1.95, 7.2], target: [0.3, 1.55, 2.7] }

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
  projects: [1.72, 1.7, 0.66, 0.85], // above Shruti's head
  story: [-5.45, 3.35, 1.6], // bookshelf
  services: [-1.3, 1.7, 0.92, 0.85], // above Vinay's head
  process: [-3.95, 1.05, -3.0, 1.35], // over the coffee table
  about: [4.85, 3.12, -4.75], // founders' ID wall
  contact: [-0.1, 0.92, 1.32],
}

// Invisible click targets over baked furniture: [centre, size] in Three coordinates.
export const HIT_BOXES = {
  story: [[-5.79, 1.5, 1.85], [0.4, 3.0, 5.2]],
  process: [[-4.0, 0.45, -3.2], [4.0, 0.9, 3.4]],
  about: [[4.85, 2.2, -4.88], [1.6, 1.3, 0.12]],
  services: [[-0.93, 0.82, 1.05], [0.32, 0.28, 0.4]], // Vinay's laptop
  projects: [[1.33, 0.82, 0.78], [0.32, 0.28, 0.4]], // Shruti's laptop
  contact: [[-0.1, 0.705, 1.32], [0.14, 0.05, 0.22]], // phone on the desk
}
