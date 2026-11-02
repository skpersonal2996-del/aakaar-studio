"""The studio cat for the web: Meshy's Puszek (CC0, MrDavKot) with its quadruped walk, cut down to a web budget.

blender --background --factory-startup --python-exit-code 1 --python blender/prepare_cat.py -- [TRIANGLES] [TEXTURE_PX]
Reads blender/source/cat/puszek-walk.glb (Meshy export, 'All Animations', single file) and writes
blender/generated/cat.glb (then `npm run assets:cat` compresses it into public/studio/cat.glb): the skinned mesh decimated before the armature (so its weights survive), the
texture resized, the walk renamed 'Walk', and two clips posed here, 'Jump' (in place: the website moves her up
onto the desk and back down) and 'Sit' (a breathing loop). The website walks it around the room (src/scene/Cat.jsx).
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TRIANGLES = int(args[0]) if args else 14000
TEXTURE_PX = int(args[1]) if len(args) > 1 else 1024
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'source/cat/puszek-walk.glb'))
for o in list(bpy.data.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o)  # Meshy's import helper
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
total = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
for o in meshes:
    bpy.context.view_layer.objects.active = o
    dec = o.modifiers.new('Decimate', 'DECIMATE'); dec.ratio = min(1.0, TRIANGLES / total)
    bpy.ops.object.modifier_move_to_index(modifier=dec.name, index=0)  # decimate the rest shape, not the posed one
    bpy.ops.object.modifier_apply(modifier=dec.name)
for img in bpy.data.images:
    if img.size[0] > TEXTURE_PX: img.scale(TEXTURE_PX, TEXTURE_PX)
walk = arm.animation_data.action
walk.name = 'Walk'

# --- posed clips -----------------------------------------------------------------------------------------
# Poses are built from the rest pose (a neutral stand) by turning bones about world axes, with the cat at its real
# size (0.65 m nose to tail, facing -Y, paws on z = 0) so offsets are in metres. +X turns pitch the nose down.
X, Z = Vector((1, 0, 0)), Vector((0, 0, 1))
scale0, loc0 = arm.scale.copy(), arm.location.copy()
def measure():
    dg = bpy.context.evaluated_depsgraph_get()
    pts = [o.matrix_world @ v.co for o in meshes for v in o.evaluated_get(dg).data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])
def rest():
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
rest()
lo, hi = measure()
arm.scale = arm.scale * (0.65 / max(hi.x - lo.x, hi.y - lo.y)); bpy.context.view_layer.update()
lo, hi = measure(); arm.location.z -= lo.z; bpy.context.view_layer.update()

def turn(name, axis, deg):
    pb = arm.pose.bones[name]; bpy.context.view_layer.update()
    world = arm.matrix_world @ pb.matrix
    q = Quaternion(axis, math.radians(deg)).to_matrix().to_4x4()
    pb.matrix = arm.matrix_world.inverted() @ Matrix.Translation(world.translation) @ q @ Matrix.Translation(-world.translation) @ world
def shift(name, offset):
    pb = arm.pose.bones[name]; bpy.context.view_layer.update()
    pb.matrix = arm.matrix_world.inverted() @ Matrix.Translation(Vector(offset)) @ arm.matrix_world @ pb.matrix
def legs(thigh, shin, foot, fl, fl0, fl1):
    for side in ('', 'R_'):
        for bone, deg in (('backleg', thigh), ('backleg0', shin), ('backleg1', foot), ('frontleg', fl), ('frontleg0', fl0), ('frontleg1', fl1)):
            if deg: turn(side + bone, X, deg)

def stand(): rest()
def crouch():  # gathering to spring: low, head forward
    rest(); turn('Hips', X, 6); shift('Hips', (0, 0.02, -0.06)); turn('chest', X, 4); turn('head', X, -12); turn('tail', X, -10)
    legs(-30, 55, -25, 25, -45, 20)
def stretch():  # take-off: front legs reaching, hind legs pushing straight back
    rest(); turn('Hips', X, -28); shift('Hips', (0, -0.02, 0.03)); turn('chest', X, -8); turn('head', X, 20); turn('tail', X, 25)
    legs(85, -10, 30, -55, 10, -10)
def tuck():  # in the air, paws gathered
    rest(); turn('Hips', X, -6); turn('head', X, 8); turn('tail', X, -15)
    legs(-45, 70, -30, -20, -70, 40)
def land():  # front paws down first, hind legs trailing
    rest(); turn('Hips', X, 14); shift('Hips', (0, 0, -0.02)); turn('chest', X, 6); turn('head', X, -18); turn('tail', X, -30)
    legs(35, 20, 0, -35, 5, 0)
def sit(breath=0.0, tilt=0.0, flick=0.0):  # upright, hind legs folded, tail curled round the side
    rest(); turn('Hips', X, -28); shift('Hips', (0, -0.04, 0)); turn('chest', X, -22 - 2 * breath)
    for side in ('', 'R_'):
        turn(side + 'backleg', X, -90); turn(side + 'backleg0', X, 130); turn(side + 'backleg1', X, -60); turn(side + 'frontleg', X, 50 + 2 * breath)
    turn('head', X, 42 + 2 * breath); turn('head', Z, tilt); turn('tail', X, 50)
    for b in ('tailstart', 'tail1', 'tail2'): turn(b, Z, 40)
    turn('tail3', Z, 40 + flick)
    shift('Hips', (0, 0, -0.152))  # front paws on the floor

def clip(name, keys, loop=False):
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    for t, pose in keys:
        pose(); arm.animation_data.action = act
        for pb in arm.pose.bones:
            pb.keyframe_insert('location', frame=round(t * FPS)); pb.keyframe_insert('rotation_quaternion', frame=round(t * FPS))
    act.use_fake_user = True
    return act

jump = clip('Jump', [(0, stand), (0.28, crouch), (0.42, stretch), (0.62, tuck), (0.82, land), (1.05, stand)])
sitting = clip('Sit', [(0, sit), (1.0, lambda: sit(1, 4, 25)), (2.0, lambda: sit(0, 6, -10)), (3.0, lambda: sit(1, 2, 30)), (4.0, sit)], loop=True)
print('CLIPS', [a.name for a in bpy.data.actions], flush=True)

# back to the model's own size and place for export
rest(); arm.scale, arm.location = scale0, loc0
arm.animation_data.action = walk
for a in (walk, jump, sitting):
    t = arm.animation_data.nla_tracks.new(); t.strips.new(a.name, 0, a); t.mute = True
after = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
out = ROOT / 'generated/cat.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_image_format='WEBP', export_image_quality=85,
                          export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
print('CAT', total, '->', after, 'triangles,', len(bpy.data.actions), 'action(s) ->', out, flush=True)
