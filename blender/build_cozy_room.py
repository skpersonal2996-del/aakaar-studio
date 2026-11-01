"""Cozy room pass: rearrange the original web room into a smaller, warmer set.

Starts from studio-portfolio.blend (web room + editable characters) and saves
studio-cozy.blend. Blender coordinates: x right, y into the room, z up.
Three (x,y,z) = Blender (x,-z,y).

Run: blender --background --python-exit-code 1 --python blender/build_cozy_room.py
"""
import bpy, math
from pathlib import Path
from mathutils import Matrix, Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')

# New shell: 9 m wide, 7.7 m deep, 3.6 m tall. Desk and characters keep their place.
X0, X1, Y0, Y1, H = -4.3, 4.7, -5.1, 2.6, 3.6
OLD_H = 4.2

bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'studio-portfolio.blend'))
scene = bpy.context.scene
O = bpy.data.objects


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


def remove(o):
    for d in reversed(tree(o)): bpy.data.objects.remove(d, do_unlink=True)


def bbox(objs):
    pts = [m.matrix_world @ Vector(c) for m in objs if m.type == 'MESH' for c in m.bound_box]
    return Vector(map(min, *pts)), Vector(map(max, *pts))


def place(o, move=(0, 0, 0), pivot=(0, 0, 0), rot=0.0, scale=(1, 1, 1)):
    """Scale/rotate a root object about a world pivot, then move it. Children follow."""
    p = Vector(pivot)
    m = (Matrix.Translation(Vector(move) + p) @ Matrix.Rotation(rot, 4, 'Z')
         @ Matrix.Diagonal((*scale, 1)) @ Matrix.Translation(-p))
    o.matrix_world = m @ o.matrix_world


def unparent(o):
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw


room = bpy.data.collections['01 · Original spacious room']
names = {
    'Node_222': 'Lounge', 'Node_382': 'Workspace', 'Node_556': 'Bookshelf', 'Node_614': 'Credenza',
    'Node_617': 'Sign', 'Node_682': 'ID wall', 'Node_829': 'City window', 'Node_723': 'Plant · banana',
    'Node_764': 'Plant · fiddle', 'Node_805': 'Plant · lounge', 'Node_817': 'Plant · trailing',
    'Node_28': 'Slat wall', 'Node_37': 'Art print', 'Node_40': 'Poster', 'Mesh_169': 'Rug · desk',
    'Mesh_50': 'Rug · lounge', 'Node_221': 'Open shelf', 'Node_381': 'Pendants',
}
for old, new in names.items(): O[old].name = new
shell = {'Mesh_0': 'Floor', 'Mesh_1': 'Wall · back', 'Mesh_2': 'Wall · left', 'Mesh_3': 'Wall · right',
         'Mesh_4': 'Ceiling', 'Mesh_5': 'Skirting · back', 'Mesh_6': 'Skirting · left', 'Mesh_7': 'Skirting · right'}
for old, new in shell.items(): O[old].name = new
for n in ['Slat wall', 'Art print', 'Poster', 'Plant · banana', 'Plant · fiddle', 'Plant · lounge', 'Plant · trailing', *shell.values()]:
    unparent(O[n])


def crop(o):
    """Clamp an axis-aligned shell part to the new room, keeping texture scale on flat parts."""
    import numpy as np
    me = o.data; mw = o.matrix_world
    world = [mw @ v.co for v in me.vertices]
    uv = me.uv_layers.active
    if uv and len(me.vertices) == 4:
        # Plane: UV is affine in world position, so refit it after moving the corners.
        A = np.array([[*world[l.vertex_index], 1] for l in me.loops]); B = np.array([uv.data[l.index].uv[:] for l in me.loops])
        fit = np.linalg.lstsq(A, B, rcond=None)[0]
    inv = mw.inverted()
    for v, w in zip(me.vertices, world):
        v.co = inv @ Vector((min(max(w.x, X0), X1), min(max(w.y, Y0), Y1), min(max(w.z, 0), H)))
    if uv and len(me.vertices) == 4:
        for l in me.loops: uv.data[l.index].uv = (np.array([*(mw @ me.vertices[l.vertex_index].co), 1]) @ fit).tolist()
    me.update()


for n in shell.values(): crop(O[n])

# Hotspots are React; the old shell, curtains, tracks and every imported light are replaced.
for n in ['Node_839', 'Node_849', 'Node_859', 'Node_869', 'Node_879', 'Node_889', 'Node_83']: remove(O[n])
for o in list(room.objects):
    if o.type == 'LIGHT': bpy.data.objects.remove(o, do_unlink=True)

dx, dy = 1.7, -2.4  # back-left corner moves with the left and back walls
place(O['Lounge'], (dx, dy, 0))
place(O['Plant · lounge'], (dx, dy, 0))
place(O['Art print'], (0.4, dy, 0))
place(O['Poster'], (-0.85, dy, -0.1))
# Slat feature wall: narrower and to the right of the open shelf, sign and credenza centred on it.
place(O['Slat wall'], (0.95, dy, 0), pivot=(1.9, 5, 0), scale=(.85, 1, H / OLD_H))
place(O['Credenza'], (0.95, dy, 0))
place(O['Sign'], (0.95, dy, -0.25))
lo, hi = bbox(tree(O['Plant · banana'])); c = (lo + hi) / 2
place(O['Plant · banana'], (4.25 - c.x, 2.15 - c.y, 0))
# Founders' ID wall turns onto the right wall.
place(O['ID wall'], (4.7 - 4.89, 1.0 - 5.0, 0), pivot=(4.89, 5.0, 0), rot=-math.pi / 2)
place(O['City window'], (X1 - 6.0, -2.2 - 2.0, 0))
lo, hi = bbox(tree(O['Plant · fiddle'])); c = (lo + hi) / 2
place(O['Plant · fiddle'], (4.1 - c.x, -0.45 - c.y, 0))
lo, hi = bbox(tree(O['Plant · trailing'])); c = (lo + hi) / 2
place(O['Plant · trailing'], (4.3 - c.x, -4.6 - c.y, 0))

# Bookshelf: keep three of its four bays, against the left wall in front of the sofa.
shelf = tree(O['Bookshelf'])
for o in [o for o in shelf if o.type == 'MESH']:
    lo, hi = bbox([o])
    if hi.y - lo.y > 4: place(o, pivot=(0, .77, 0), scale=(1, 3.94 / 5.24, 1))
    elif (lo.y + hi.y) / 2 < -3.2: bpy.data.objects.remove(o, do_unlink=True)
place(O['Bookshelf'], (dx, -1.15 - .77, 0))

# Rugs no longer overlap: desk rug in front, lounge rug under the coffee table.
for n, (ax0, ay0, ax1, ay1) in {'Rug · desk': (-2.2, -2.3, 2.6, 0.12), 'Rug · lounge': (-4.0, 0.22, -0.4, 2.3)}.items():
    o = O[n]; lo, hi = bbox([o])
    place(o, pivot=(lo.x, lo.y, 0), scale=((ax1 - ax0) / (hi.x - lo.x), (ay1 - ay0) / (hi.y - lo.y), 1))
    lo, _ = bbox([o]); place(o, (ax0 - lo.x, ay0 - lo.y, 0))

# Pendant cords end at the lower ceiling.
for o in tree(O['Pendants']):
    if o.type == 'MESH':
        lo, hi = bbox([o])
        if hi.z > 4: place(o, pivot=(0, 0, lo.z), scale=(1, 1, (H - lo.z) / (hi.z - lo.z)))

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'studio-cozy.blend'))
print('COZY_LAYOUT_COMPLETE', flush=True)
