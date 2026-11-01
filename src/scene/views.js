// The room is baked in Blender (blender/build_cozy_room.py): 9 m wide (x -4.3..4.7), 7.7 m deep
// (z -2.6..5.1), 3.6 m tall. The front wall is left open for the camera.
// Blender (x, y, z) = Three (x, -z, y).
export const ROOM = { X0: -4.3, X1: 4.7, Z0: -2.6, Z1: 5.1, H: 3.6 }

// Where the shared desk sits; people and laptops are placed relative to it.
export const DESK = [0.2, 0, 0.9]

// Live (unbaked) features on the walls.
export const SIGN = { position: [2.845, 2.53, -2.47], size: [2.95, 1.3] } // backlit sign on the slat wall
export const WINDOW = { x: 4.68, y: 2.05, z: 2.2, width: 2.4, height: 1.8 } // city view, right wall

// Where each character pair sits (blender/place_characters.py → generated/seats-*.json). Characters,
// chairs and laptops are live, not baked, because each pair sits at its own distance from the desk.
// `person` is the hip point on the floor. The developer faces +x and the designer -x, each turned 20°
// towards the camera; rotations are about y. Laptops are scaled to each cast's hands.
const seat = (person, rotation, chair, chairRotation, laptop, laptopRotation, laptopScale) =>
  ({ person, rotation, chair, chairRotation, laptop, laptopRotation, laptopScale })
export const SEATS = {
  classic: {
    developer: seat([-1.33, 0, 0.902], 1.222, [-1.359, 0, 0.892], 1.222, [-0.924, 0.765, 1.05], -1.92, 1.15),
    designer: seat([1.75, 0, 0.625], -1.222, [1.778, 0, 0.615], -1.222, [1.324, 0.765, 0.78], 1.92, 1.15),
  },
  chibi: {
    developer: seat([-1.298, 0, 0.917], 1.222, [-1.326, 0, 0.906], 1.222, [-0.932, 0.765, 1.05], -1.92, 1.35),
    designer: seat([1.702, 0, 0.645], -1.222, [1.73, 0, 0.635], -1.222, [1.332, 0.765, 0.78], 1.92, 1.35),
  },
}

export const INTRO = { pos: [0.6, 2.8, 10.5], target: [0.4, 1.4, 0] }
export const HOME = { pos: [-0.75, 1.72, 4.45], target: [0.1, 1.0, 0.45] } // the Blender hero camera (lookdev_cozy.py)

// Camera framing for each section: where the camera goes and what it looks at.
export const VIEWS = {
  projects: { pos: [2.55, 1.6, 2.4], target: [1.33, 0.95, 0.78] },
  story: { pos: [-1.6, 1.8, 3.7], target: [-4.2, 1.5, 2.7] }, // the bookshelf on the left wall
  services: { pos: [-2.25, 1.65, 1.75], target: [-0.93, 0.92, 1.05] }, // over Vinay's shoulder onto his laptop
  process: { pos: [-2.6, 1.9, 2.9], target: [-2.5, 0.7, -1.0] }, // the sofa in the back-left corner
  about: { pos: [2.6, 2.0, -0.6], target: [4.7, 2.1, -1.0] }, // the founders' ID wall, right wall
  contact: { pos: [0.25, 1.4, 2.35], target: [-0.1, 0.78, 1.32] },
}

// Gentle close-ups that don't open a panel.
export const PEEKS = {
  developer: { pos: [0.55, 1.7, 3.4], target: [-1.15, 1.1, 1.0] },
  designer: { pos: [-0.15, 1.7, 3.3], target: [1.55, 1.1, 0.78] },
}

// Glowing markers, one per section.
export const HOTSPOTS = {
  projects: [1.33, 1.22, 0.78],
  story: [-4.0, 2.55, 3.1], // bookshelf
  services: [-0.93, 1.2, 1.05], // above Vinay's laptop
  process: [-2.2, 1.0, -0.36, 1.35], // over the coffee table; 4th value = size boost
  about: [4.55, 3.0, -1.0], // founders' ID wall
  contact: [-0.1, 1.0, 1.32],
}

// Invisible click targets over baked furniture: [centre, size] in Three coordinates.
export const HIT_BOXES = {
  story: [[-4.1, 1.5, 3.1], [0.45, 3.0, 3.9]],
  process: [[-2.3, 0.45, -1.0], [4.2, 0.9, 3.4]],
  about: [[4.6, 2.2, -1.04], [0.12, 1.3, 1.65]],
  services: [[-0.93, 0.9, 1.05], [0.32, 0.28, 0.4]], // Vinay's laptop
  projects: [[1.33, 0.9, 0.78], [0.32, 0.28, 0.4]], // Shruti's laptop
  contact: [[-0.1, 0.79, 1.32], [0.14, 0.05, 0.22]], // phone on the desk
}
