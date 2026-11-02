"""Seat a character pair in the assembled room: chairs and laptops move to where that pair's hands are.

blender --background --python-exit-code 1 --python blender/place_characters.py -- adult|chibi [cozy|spacious]
Reads studio-assembled.blend (or studio-spacious-assembled.blend) and generated/<name>-seated.{glb,json}; writes
studio-<variant>.blend (studio-spacious-<variant>.blend) and
generated/seats-<variant>.json (the placements the website uses for the character toggle, in Three coordinates).
Blender (x, y, z) = Three (x, z, -y).
"""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:]
variant, room = args[0], (args[1] if len(args) > 1 else 'cozy')
prefix = 'studio-spacious-' if room == 'spacious' else 'studio-'  # both rooms share the desk position
names = {'adult': ('guy', 'girl'), 'chibi': ('chibi-guy', 'chibi-girl')}[variant]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / f'{prefix}assembled.blend'))
scene = bpy.context.scene
O = bpy.data.objects
for c in [c for c in bpy.data.collections if 'editable typing' in c.name]:  # the earlier characters
    for o in list(c.all_objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(c)
col = bpy.data.collections.new(f'07 · Characters · {variant}'); scene.collection.children.link(col)
layer = bpy.context.view_layer.layer_collection.children[col.name]

DESK_EDGE = {'vinay': -1.15, 'shruti': 1.55}  # desk ends facing each seat (x)
SEAT_Y = {'vinay': -1.05, 'shruti': -.78}
FACING = {'vinay': 1, 'shruti': -1}           # +x or -x
TURN = math.radians(20)                       # each seat turns a little towards the camera, as on the board


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


def three(v):  # Blender → Three coordinates
    return [v[0], v[2], -v[1]]


seats = {}
for name, seat in zip(names, ('vinay', 'shruti')):
    meta = json.loads((ROOT / f'generated/{name}-seated.json').read_text())
    f = FACING[seat]
    laptop, chair = O[f'Laptop · {seat.title()}'], O[f'Office chair · {seat.title()}']
    laptop.scale *= meta['laptop_scale']            # sized to the cast's hands (seat_meshy_character.py)
    laptop.location = (DESK_EDGE[seat], SEAT_Y[seat], .68)
    bpy.context.view_layer.update()
    pts = [m.matrix_world @ Vector(c) for m in tree(laptop) if m.type == 'MESH' for c in m.bound_box]
    near = min(p.x for p in pts) if f == 1 else max(p.x for p in pts)
    inset = meta['laptop_inset']                    # its near edge from the desk edge
    laptop_x = DESK_EDGE[seat] + (DESK_EDGE[seat] + f * inset - near)
    laptop.location.x = laptop_x
    front = DESK_EDGE[seat] + f * inset
    wrist_x = front + f * .03                      # wrists on the palm rest, fingers on the keys
    hip_x = wrist_x - f * -meta['wrist_mid'][1]    # wrist_mid y is negative (in front of the hips)
    rot = math.pi / 2 if f == 1 else -math.pi / 2  # the character faces -Y in its own file
    bpy.context.view_layer.active_layer_collection = layer
    before, before_actions = set(O), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'generated/{name}-seated.glb'))
    anchor = O.new(f'{name} · seat', None); col.objects.link(anchor)
    for o in [o for o in O if o not in before and o.parent is None and o is not anchor]: o.parent = anchor
    anchor.location = (hip_x, SEAT_Y[seat], 0); anchor.rotation_euler.z = rot
    chair.location = (hip_x - f * .03, SEAT_Y[seat], 0)
    arm = next(o for o in O if o not in before and o.type == 'ARMATURE')
    # This import's own typing action (a second import gets 'TypingIdle.001').
    typing = next(a for a in bpy.data.actions if a not in before_actions and a.name.startswith('TypingIdle'))
    arm.animation_data.action = typing; arm.animation_data.action_slot = typing.slots[0]
    # Turn person, chair and laptop together about the laptop, so the hands stay on the keys.
    turn = -f * TURN
    pivot = Vector((laptop_x, SEAT_Y[seat], 0))
    for o in (anchor, chair, laptop):
        d = o.location - pivot
        o.location = pivot + Vector((d.x * math.cos(turn) - d.y * math.sin(turn), d.x * math.sin(turn) + d.y * math.cos(turn), d.z))
        o.rotation_euler.z += turn
    seats[seat] = {'character': name, 'hip': three(anchor.location), 'rotation': anchor.rotation_euler.z,
                   'chair': three(chair.location), 'chair_rotation': chair.rotation_euler.z,
                   'laptop': three(laptop.location), 'laptop_rotation': laptop.rotation_euler.z,
                   'laptop_scale': meta['laptop_scale']}
scene.frame_set(40)
# The body must stay clear of the desk: how far each lap and belly (below the desk top) is from its edge.
graph = bpy.context.evaluated_depsgraph_get()
for name, seat in zip(names, ('vinay', 'shruti')):
    body = max((o for o in tree(O[f'{name} · seat']) if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
    ev = body.evaluated_get(graph).data; mw = body.matrix_world; f = FACING[seat]
    names_of = {g.index: g.name for g in body.vertex_groups}
    part = lambda v, name: v.groups and name in names_of[max(v.groups, key=lambda g: g.weight).group]
    belly = [f * (mw @ v.co).x for v, src in zip(ev.vertices, body.data.vertices) if .62 < (mw @ v.co).z < .68 and part(src, 'Spine')]
    arms = [(mw @ v.co).z for v, src in zip(ev.vertices, body.data.vertices)
            if f * (mw @ v.co).x > f * DESK_EDGE[seat] and part(src, 'Arm')]  # forearms over the desk
    print('CLEARANCE', name, 'belly', round(f * DESK_EDGE[seat] - max(belly), 3), 'm; forearms sink',
          round(max(0, .68 - min(arms)), 4), 'm into the desk', flush=True)
(ROOT / f'generated/seats-{variant}.json').write_text(json.dumps(seats, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'{prefix}{variant}.blend'))
print('PLACED', variant, json.dumps(seats), flush=True)
