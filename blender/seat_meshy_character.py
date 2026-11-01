"""Seat a Meshy-rigged character, add finger bones, and bake a typing loop plus a wave.

blender --background --factory-startup --python-exit-code 1 --python blender/seat_meshy_character.py -- NAME SEAT [SCALE]
  NAME   rigged GLB in blender/source/meshy/<NAME>-rigged.glb (guy, girl, chibi-guy, chibi-girl)
  SEAT   vinay | shruti: which desk seat; decides the waving hand (see the wave below)
  SCALE  uniform size factor (chibi rigs are 1.2 m and are scaled up to sit in full-size chairs)

The character faces -Y with its hips centred above the origin, 0.53 m up (just above the 0.49 m chair
cushion), like the earlier characters. Writes blender/generated/<NAME>-seated.glb with two actions,
TypingIdle (8 s loop) and Wave (upper body only, 2.6 s; both hands stop typing), and <NAME>-seated.json with the wrist position
the room uses to line the laptop up with the hands.
"""
import bpy, sys, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from bpy_extras import anim_utils

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:]
name, seat = args[0], args[1]
scale = float(args[2]) if len(args) > 2 else 1.0
chibi = 'chibi' in name
# Chibi waves with the hand further from the camera (the near one would cover the big head); classic with
# the near hand. The camera is to the developer's right and the designer's left.
wave_side = ('Left' if seat == 'vinay' else 'Right') if chibi else ('Right' if seat == 'vinay' else 'Left')
HIP_Z, DESK_Z = .53, .765

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(ROOT / f'source/meshy/{name}-rigged.glb'))
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = max((o for o in scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
for o in list(scene.objects):
    if o not in (arm, mesh): bpy.data.objects.remove(o, do_unlink=True)
for o in (arm, mesh):
    if o.animation_data: o.animation_data_clear()
for action in list(bpy.data.actions): bpy.data.actions.remove(action)
arm.scale = arm.scale * scale
bpy.context.view_layer.update()
W = lambda: arm.matrix_world
D = arm.data.bones
P = arm.pose.bones
world = lambda v: W() @ v
height = world(D['head_end'].head_local).z - world(D['LeftToeBase'].head_local).z + .04

# --- finger bones: Meshy's hands are a single bone ----------------------------------------------
weights = {g.name: g.index for g in mesh.vertex_groups}
coords = np.array([v.co[:] for v in mesh.data.vertices])
mesh_to_arm = (W().inverted() @ mesh.matrix_world)
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
# The glTF importer leaves Meshy's bone tails pointing off into space; IK solves for the tail, so each
# bone must end at the next joint. With an identity pose the skin does not move.
eb = arm.data.edit_bones
chains = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end']
for side in ('Left', 'Right'):
    chains += [None, f'{side}Shoulder', f'{side}Arm', f'{side}ForeArm', f'{side}Hand']
    chains += [None, f'{side}UpLeg', f'{side}Leg', f'{side}Foot', f'{side}ToeBase']
for a, b in zip(chains, chains[1:]):
    if a and b and a != 'head_end': eb[a].tail = eb[b].head
for side in ('Left', 'Right'):
    toe, foot = eb[f'{side}ToeBase'], eb[f'{side}Foot']
    toe.tail = toe.head + (toe.head - foot.head).normalized() * .05 / arm.scale.x
eb['Hips'].tail = eb['Spine02'].head
eb['head_end'].tail = eb['head_end'].head + Vector((0, 0, .05 / arm.scale.x))
fingers = {}
for side in ('Left', 'Right'):
    hand = arm.data.edit_bones[f'{side}Hand']
    elbow = arm.data.edit_bones[f'{side}ForeArm'].head
    wrist = hand.head.copy(); d = (wrist - elbow).normalized()
    gi = weights[f'{side}Hand']
    ids = [v.index for v in mesh.data.vertices if any(g.group == gi and g.weight > .5 for g in v.groups)]
    pts = np.array([mesh_to_arm @ Vector(coords[i]) for i in ids])
    along = (pts - np.array(wrist)) @ np.array(d)
    reach = float(np.percentile(along, 99))
    knuckle, mid = wrist + d * reach * .48, wrist + d * reach * .74
    hand.tail = knuckle  # the palm ends at the knuckles
    b1 = arm.data.edit_bones.new(f'{side}Fingers1'); b1.head, b1.tail, b1.parent = knuckle, mid, hand
    b2 = arm.data.edit_bones.new(f'{side}Fingers2'); b2.head, b2.tail, b2.parent = mid, wrist + d * reach, b1
    b2.use_connect = True
    for b in (b1, b2): b.roll = hand.roll
    fingers[side] = (ids, along, reach)
bpy.ops.object.mode_set(mode='OBJECT')
for side, (ids, along, reach) in fingers.items():
    hand_group = mesh.vertex_groups[f'{side}Hand']
    g1 = mesh.vertex_groups.new(name=f'{side}Fingers1'); g2 = mesh.vertex_groups.new(name=f'{side}Fingers2')
    for i, t in zip(ids, along):
        f = t / reach
        if f < .4: continue
        w1 = min(1, (f - .4) / .14)            # blends from the palm into the fingers
        w2 = min(1, max(0, (f - .7) / .1))
        hand_group.add([i], 1 - w1, 'REPLACE'); g1.add([i], w1 * (1 - w2), 'REPLACE'); g2.add([i], w1 * w2, 'REPLACE')

# --- rigid head and hair -------------------------------------------------------------------------
# The face and hair must not stretch with the arms: everything above the neck, plus long hair (dark,
# behind the shoulders), follows the head bone rigidly.
local = 1 / mesh.matrix_world.to_scale().z  # metres to mesh units
neck_z = (mesh.matrix_world.inverted() @ world(D['neck'].head_local)).z + .03 * local
rigid = set(np.flatnonzero(coords[:, 2] >= neck_z).tolist())
image = next((n.image for n in mesh.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE'
              and n.image.colorspace_settings.name == 'sRGB'), None)
if 'girl' in name and image:
    w, h = image.size; px = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, 4)
    uv = np.array([d.uv[:] for d in mesh.data.uv_layers.active.data])
    col = px[(np.clip(uv[:, 1], 0, .9999) * h).astype(int), (np.clip(uv[:, 0], 0, .9999) * w).astype(int), :3]
    vi = np.array([l.vertex_index for l in mesh.data.loops]); vc = np.zeros((len(coords), 3)); n = np.zeros(len(coords))
    np.add.at(vc, vi, col); np.add.at(n, vi, 1); vc /= np.maximum(n[:, None], 1)
    shoulder_z = (mesh.matrix_world.inverted() @ world(D['LeftArm'].head_local)).z
    hip_z = (mesh.matrix_world.inverted() @ world(D['Hips'].head_local)).z
    back = coords[:, 1] > np.median(coords[coords[:, 2] > shoulder_z, 1])  # behind the body's mid-plane
    hair = (coords[:, 2] > hip_z + (shoulder_z - hip_z) * .25) & (vc.max(1) < .35) & back
    rigid |= set(np.flatnonzero(hair).tolist())
rigid = sorted(rigid)
for g in mesh.vertex_groups: g.remove(rigid)
mesh.vertex_groups['Head'].add(rigid, 1, 'REPLACE')

# --- seated pose with IK -------------------------------------------------------------------------
for pb in P: pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
hip = (world(D['LeftUpLeg'].head_local) + world(D['RightUpLeg'].head_local)) / 2
arm.location += Vector((-hip.x, -hip.y, HIP_Z - hip.z))
bpy.context.view_layer.update()
controls = bpy.data.collections.new('Pose controls'); scene.collection.children.link(controls)


def empty(label, loc, rot=None):
    o = bpy.data.objects.new(label, None); controls.objects.link(o); o.location = loc
    if rot is not None: o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = rot
    return o


def rotate_world(bone, axis, angle):
    pb = P[bone]; pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(pb.matrix.to_quaternion().inverted() @ Vector(axis), angle)
    bpy.context.view_layer.update()


def ik(bone, target, pole, want):
    pb = P[bone]; con = pb.constraints.new('IK'); con.target = target; con.pole_target = pole
    con.chain_count = 2; con.use_stretch = False; con.iterations = 200
    best = (1e9, 0)
    for i in range(48):  # find the pole angle that bends the joint where we want it
        con.pole_angle = -math.pi + i * math.tau / 48; bpy.context.view_layer.update()
        cost = ((W() @ pb.head) - Vector(want)).length_squared
        if cost < best[0]: best = (cost, con.pole_angle)
    con.pole_angle = best[1]; bpy.context.view_layer.update()


for bone in ('Spine02', 'Spine01', 'Spine'): rotate_world(bone, (1, 0, 0), math.radians(-3))  # lean slightly in
rotate_world('Head', (1, 0, 0), math.radians(-6))                                              # look at the screen
shoulder = {s: world(D[f'{s}Arm'].head_local) for s in ('Left', 'Right')}
arm_len = (D['LeftArm'].head_local - D['LeftForeArm'].head_local).length * arm.scale.x \
    + (D['LeftForeArm'].head_local - D['LeftHand'].head_local).length * arm.scale.x
leg_len = (D['LeftUpLeg'].head_local - D['LeftLeg'].head_local).length * arm.scale.x
shin = (D['LeftLeg'].head_local - D['LeftFoot'].head_local).length * arm.scale.x
ankle_z = max(.09 * scale, HIP_Z - shin)  # feet down, as low as the shin allows (chibi feet may hang)
wrists = {}
for side, sign in (('Left', 1), ('Right', -1)):
    knee_y = -leg_len * .95
    target = empty(f'{side} ankle', (sign * .1 * scale, knee_y - .02, ankle_z))
    ik(f'{side}Leg', target, empty(f'{side} knee pole', (sign * .12, -1.0, HIP_Z + .2)), (sign * .1, knee_y, HIP_Z + .02))
    sh = shoulder[side]
    dz = DESK_Z + .04 - sh.z; dx = sign * .09 - sh.x
    reach = arm_len * .9
    dy = -math.sqrt(max(.01, reach ** 2 - dz ** 2 - dx ** 2))
    wrist = empty(f'{side} wrist', (sign * .09, sh.y + dy, DESK_Z + .04))
    ik(f'{side}ForeArm', wrist, empty(f'{side} elbow pole', (sign * .4, .1, sh.z - .1)),
       ((sh.x + wrist.location.x) / 2 + sign * .12, sh.y + dy * .45, sh.z - .14))
    wrists[side] = wrist
    # Palm down onto the keyboard: aim the hand along the forearm, flattened.
    con = P[f'{side}Hand'].constraints.new('DAMPED_TRACK'); con.target = empty(f'{side} fingertips', wrist.location + Vector((-sign * .02, -.12, -.02)))
    con.track_axis = 'TRACK_Y'
bpy.context.view_layer.update()

# --- typing loop (8 s at 30 fps), keyed through the controls, then baked to plain bone keys ------------
scene.render.fps = 30; scene.frame_start, scene.frame_end = 1, 241
base = {b: P[b].rotation_quaternion.copy() for b in ('Spine', 'Spine01', 'Head')}
axis = {b: P[b].matrix.to_quaternion().inverted() @ Vector((1, 0, 0)) for b in base}
finger_axis = {s: P[f'{s}Fingers1'].matrix.to_quaternion().inverted() @ Vector((1, 0, 0)) for s in ('Left', 'Right')}
wrist_base = {s: o.location.copy() for s, o in wrists.items()}
for frame in range(1, 242):
    t = (frame - 1) / 30
    for b in base:
        amount = .004 * math.sin(math.tau * t / 4) if b != 'Head' else .03 * math.sin(math.tau * t / 8)
        P[b].rotation_quaternion = base[b] @ Quaternion(axis[b], amount)
        P[b].keyframe_insert('rotation_quaternion', frame=frame, group=b)
    for side, freq, phase in (('Left', 3, 0), ('Right', 3.5, 1.8)):
        burst = .35 + .65 * (.5 + .5 * math.cos(math.tau * t / 4))
        tap = max(0, math.sin(math.tau * freq * t + phase))
        wrists[side].location = wrist_base[side] + Vector((0, 0, .004 * tap * burst))
        wrists[side].keyframe_insert('location', frame=frame)
        for bone, amp in ((f'{side}Fingers1', .35), (f'{side}Fingers2', .25)):
            P[bone].rotation_quaternion = Quaternion(finger_axis[side], -(.15 + amp * tap * burst))
            P[bone].keyframe_insert('rotation_quaternion', frame=frame, group=bone)
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.nla.bake(frame_start=1, frame_end=241, only_selected=False, visual_keying=True, clear_constraints=True, use_current_action=False,
                 clean_curves=True, bake_types={'POSE'}, channel_types={'LOCATION', 'ROTATION'})
typing = arm.animation_data.action; typing.name = 'TypingIdle'

# --- wave (upper body only) ------------------------------------------------------------------------
def curves(action):
    """Blender 5 keeps F-curves in the action's channel bag for its (single) slot."""
    return anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves



scene.frame_set(1); bpy.context.view_layer.update()
wave = typing.copy(); wave.name = 'Wave'
arm.animation_data.action = wave; arm.animation_data.action_slot = wave.slots[0]
# Both arms: the other hand rests on the keys, still (one key each), while the person waves.
keep = {'Spine', 'Spine01', 'Spine02', 'neck', 'Head'} | {f'{side}{b}' for side in ('Left', 'Right')
        for b in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'Fingers1', 'Fingers2')}
for fc in list(curves(wave)):
    bone = fc.data_path.split('"')[1] if '"' in fc.data_path else ''
    if bone not in keep: curves(wave).remove(fc); continue
    first = fc.keyframe_points[0].co[1]; fc.keyframe_points.clear(); fc.keyframe_points.insert(1, first)  # restart from the typing pose
sign = 1 if wave_side == 'Left' else -1


def aim(bone, direction):
    """Point a bone along a world direction by rotating it about its head."""
    pb = P[bone]; bpy.context.view_layer.update()
    head = pb.head.copy(); cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference((W().inverted().to_3x3() @ Vector(direction)).normalized())
    pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
    bpy.context.view_layer.update()


def key(frame, bones):
    for b in bones: P[b].keyframe_insert('rotation_quaternion', frame=frame, group=b)


hand, fingers = f'{wave_side}Hand', [f'{wave_side}Fingers1', f'{wave_side}Fingers2']
arm_bones = [f'{wave_side}Arm', f'{wave_side}ForeArm', hand, 'Head', 'neck'] + ([] if chibi else fingers)
scene.frame_set(1); key(1, arm_bones)
start = {b: P[b].rotation_quaternion.copy() for b in arm_bones}  # the typing pose
palm = P[hand].matrix.to_3x3().inverted() @ Vector((0, 0, -1))  # palm normal in the hand's frame (down while typing)
toward = -1 if seat == 'vinay' else 1  # the camera is to the developer's right and the designer's left
# The hero camera seen from this seat, in the character's frame (lookdev_cozy.py and place_characters.py).
to_cam = Vector((-.86, -.5, .25) if seat == 'vinay' else (.59, -.81, .25)).normalized()
across = Vector((-to_cam.y, to_cam.x, 0)).normalized()  # left to right on screen
to_arm = lambda v: (W().to_3x3().normalized().inverted() @ v).normalized()


def palm_to_camera():
    """Twist the hand about its own length so the open palm faces the camera."""
    pb = P[hand]; length = (pb.tail - pb.head).normalized(); cam = to_arm(to_cam)
    have = pb.matrix.to_3x3() @ palm; have -= length * have.dot(length)
    want = cam - length * cam.dot(length)
    angle = have.angle(want, 0) * (1 if have.cross(want).dot(length) > 0 else -1)
    rotate_world(hand, length, angle)


# Chibi: the short arms cannot lift the hand clear of the big head, so the far hand rises up and out to
# the open side of the frame. Classic: a small, friendly wave with the near hand, the elbow out and a little
# low and the hand at about shoulder height, rocking across the camera's view with the palm towards it.
swings = ((12, 0), (22, 1), (32, -1), (42, 1), (52, -1), (62, 0)) if chibi else \
    ((12, 0), (19, 1), (26, -1), (33, 1), (40, -1), (47, 1), (54, -1), (62, 0))
for frame, swing in swings:
    for b in arm_bones: P[b].rotation_quaternion = start[b]
    bpy.context.view_layer.update()
    if chibi:
        aim(f'{wave_side}Arm', Vector((sign * .6, -.45, .65)).normalized())
        aim(f'{wave_side}ForeArm', Vector((sign * (.45 + .2 * swing), -.45 - .2 * swing, 1)).normalized())
        aim(hand, Vector((sign * (.5 + .3 * swing), -.5 - .3 * swing, 1)).normalized())
    else:
        aim(f'{wave_side}Arm', Vector((sign * .8, -.2, -.45)).normalized())
        rock = swing + .4 * toward  # leans away from the face on screen, so the hand never covers it
        aim(f'{wave_side}ForeArm', (Vector((sign * .4, -.12, 1)) + across * .25 * rock).normalized())
        aim(hand, (Vector((sign * .35, -.1, 1)) + across * .45 * rock).normalized())
        palm_to_camera()
        for b in fingers: P[b].rotation_quaternion = Quaternion()  # open hand
    rotate_world('Head', (0, 0, 1), math.radians(32 * toward))  # turn towards the camera
    rotate_world('neck', (0, 0, 1), math.radians(12 * toward))
    rotate_world('Head', (1, 0, 0), math.radians(8))  # lift the chin off the laptop
    key(frame, arm_bones)
scene.frame_set(1)
for b in arm_bones:  # settle back into the typing pose
    for fc in curves(wave):
        if fc.data_path == f'pose.bones["{b}"].rotation_quaternion':
            fc.keyframe_points.insert(78, fc.keyframe_points[0].co[1])

# --- export -------------------------------------------------------------------------------------
arm.animation_data.action = typing
for action in (typing, wave): action.use_fake_user = True
track = arm.animation_data.nla_tracks.new(); track.strips.new('Wave', 1, wave); track.mute = True
scene.frame_set(1); bpy.context.view_layer.update()
out = ROOT / 'generated'; out.mkdir(exist_ok=True)
wrist_mid = (wrist_base['Left'] + wrist_base['Right']) / 2
meta = {'name': name, 'seat': seat, 'scale': scale, 'height_m': height * 1, 'hip_z': HIP_Z,
        'wrist_mid': list(wrist_mid), 'rigid_vertices': len(rigid), 'wave_hand': wave_side}
(out / f'{name}-seated.json').write_text(json.dumps(meta, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'{name}-seated.blend'))
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out / f'{name}-seated.glb'), export_format='GLB', use_selection=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_skins=True, export_yup=True)
print('SEATED', json.dumps(meta), flush=True)
