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
wave_side = 'Right' if seat == 'vinay' else 'Left'  # the hand nearer the camera (see the wave below)
HIP_Z, DESK_Z = .53, .68  # build_furniture.py DESK_TOP
# Laptop size for this cast (place_characters.py scales laptop.glb by it): the chibi hands are big for their
# bodies, so their laptop is larger to keep the fingers on the keys.
LAPTOP_SCALE = 1.35 if 'chibi' in name else 1.15
# The laptop's near edge from the desk edge (round chibi bellies sit further back), and the wrists 3 cm
# onto the laptop: the desk edge is DESK_BACK behind the wrists. place_characters.py reads both.
LAPTOP_INSET = 0 if 'chibi' in name else .1  # flush with the edge for the chibis: their short arms put the round belly close to the hands
DESK_BACK = LAPTOP_INSET + .03

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
fingers, hand_dir = {}, {}
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
    # Twist bone for the lower forearm: rolling the hand palm-down is spread from elbow to wrist through it, as
    # a real forearm turns, instead of wringing the cuff around the wrist.
    fa = arm.data.edit_bones[f'{side}ForeArm']
    tw = arm.data.edit_bones.new(f'{side}ForeArmTwist'); tw.head, tw.tail = fa.head.lerp(fa.tail, .5), fa.tail.copy()
    tw.parent, tw.roll = fa, fa.roll
    fingers[side] = (ids, along, reach); hand_dir[side] = np.array(d)
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
# Palm direction in each hand bone's frame: the palm is the flattest part of the hand (least spread across
# its thickness), and in Meshy's rest pose it faces down. Rigs differ in how the hand bone is rolled.
# Forearm skin and sleeve: weight shifts to the twist bone from the middle of the forearm to the wrist, and the
# cuff (hand-weighted but behind the wrist) follows the twist bone rather than the hand.
for side in ('Left', 'Right'):
    fa = D[f'{side}ForeArm']; head, tail = fa.head_local, fa.tail_local; axis = tail - head
    g_fa, g_hand = mesh.vertex_groups[f'{side}ForeArm'], mesh.vertex_groups[f'{side}Hand']
    g_tw = mesh.vertex_groups.new(name=f'{side}ForeArmTwist')
    for v in mesh.data.vertices:
        w = {g.group: g.weight for g in v.groups}
        if g_fa.index not in w and g_hand.index not in w: continue
        s = (mesh_to_arm @ v.co - head).dot(axis) / axis.length_squared  # 0 at the elbow, 1 at the wrist
        k = min(1, max(0, (s - .25) / .75))
        k = k * k * (3 - 2 * k)
        moved = w.get(g_fa.index, 0) * k
        if s < 1.02: moved += w.get(g_hand.index, 0) * min(1, (1.02 - s) / .04)  # the cuff
        if moved < 1e-3: continue
        if g_fa.index in w: g_fa.add([v.index], w[g_fa.index] * (1 - k), 'REPLACE')
        if g_hand.index in w and s < 1.02: g_hand.add([v.index], w[g_hand.index] * (1 - min(1, (1.02 - s) / .04)), 'REPLACE')
        g_tw.add([v.index], moved, 'REPLACE')

palm_rest, flatness = {}, {}
down_arm = (W().to_3x3().inverted() @ Vector((0, 0, -1))).normalized()
for side, (ids, along, reach) in fingers.items():
    pts = np.array([mesh_to_arm @ Vector(coords[i]) for i, t in zip(ids, along) if t < reach * .45])
    if 'chibi' in name:
        # Stubby chibi palms are about as short as they are thick, so their least spread can run along the hand
        # (a roll about the hand's length then has nothing to aim). Measure the spread across the hand only.
        d = hand_dir[side]; pts = pts - np.outer(pts @ d, d)
    spread, axes = np.linalg.eigh(np.cov((pts - pts.mean(0)).T))
    n = Vector(axes[:, 0])
    if 'chibi' in name:
        spread, n = spread[1:], Vector(axes[:, 1])  # axes[:, 0] is the hand's length (no spread left along it)
    if n.dot(down_arm) < 0: n = -n
    palm_rest[side], flatness[side] = n, spread[0] / spread[1]
# A half-closed hand has no clear flat side: mirror the flatter hand's palm across the body (rigs are symmetric).
flat, other = sorted(palm_rest, key=flatness.get)
print('PALM flatness', {k: round(v, 3) for k, v in flatness.items()}, flush=True)
if flatness[other] > 1.6 * flatness[flat]:
    palm_rest[other] = Vector((-palm_rest[flat].x, palm_rest[flat].y, palm_rest[flat].z))
for side in palm_rest:
    palm_rest[side] = (D[f'{side}Hand'].matrix_local.to_3x3().inverted() @ palm_rest[side]).normalized()

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

# --- torso weights and shape: the sweater follows the spine, not the arms -----------------------------
# Meshy's automatic rig hands most of the torso between the hips and the armpits to the upper-arm bones (about
# 70 % of those vertices), so reaching forward to type dragged the lats and sides of the sweater outwards: seated,
# the torso came out 30-60 % wider than at rest. The torso is re-weighted to the spine chain by height, fading back
# to Meshy's weights near the armpits and hips so those joints still bend. The new weights depend on rest
# position only, so the copies of a vertex at a UV seam stay together (re-weighting by mesh edges tore the seams).
smoothstep = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
M = np.array(mesh.matrix_world)
pos = (np.c_[coords, np.ones(len(coords))] @ M.T)[:, :3]
hips_w = world(D['Hips'].head_local)
armpit_z = (world(D['LeftArm'].head_local).z + world(D['RightArm'].head_local).z) / 2
inner = min(abs(world(D[f'{s}Arm'].head_local).x - hips_w.x) for s in ('Left', 'Right'))
r = np.abs(pos[:, 0] - hips_w.x) / inner                  # 0 on the spine, 1 under the shoulder joint
t = (pos[:, 2] - hips_w.z) / (armpit_z - hips_w.z)       # 0 at the hips, 1 at the armpits
mix = (1 - smoothstep(.8, 1.0, r)) * smoothstep(-.05, .12, t) * (1 - smoothstep(.88, 1.02, t))
mix[rigid] = 0                                            # face and long hair stay with the head
chain = [n for n in ('Hips', 'Spine02', 'Spine01', 'Spine') if n in mesh.vertex_groups]
heights = np.array([world(D[n].head_local).z for n in chain])
moved = np.flatnonzero(mix > 1e-3)
for i in moved.tolist():
    v = mesh.data.vertices[i]; m = float(mix[i])
    old = {g.group: g.weight for g in v.groups}
    total = sum(old.values()) or 1.0
    k = int(np.clip(np.searchsorted(heights, pos[i, 2]) - 1, 0, len(chain) - 2))
    f = float(np.clip((pos[i, 2] - heights[k]) / max(heights[k + 1] - heights[k], 1e-6), 0, 1))
    new = {gi: w / total * (1 - m) for gi, w in old.items()}
    for n, w in ((chain[k], 1 - f), (chain[k + 1], f)):
        gi = mesh.vertex_groups[n].index; new[gi] = new.get(gi, 0) + m * w
    for gi in set(old) | set(new):
        g = mesh.vertex_groups[gi]
        if new.get(gi, 0) > 1e-4: g.add([i], new[gi], 'REPLACE')
        else: g.remove([i])
# Meshy cut the sweater boxy, nearly as wide as the shoulders: taper the waist and lats in towards the spine (the
# same smooth region, so seam copies move together).
TAPER = .2
taper = TAPER * mix * smoothstep(.05, .35, t) * (1 - smoothstep(.75, 1.0, t))
pos[:, 0] = hips_w.x + (pos[:, 0] - hips_w.x) * (1 - taper)
coords = (np.c_[pos, np.ones(len(pos))] @ np.linalg.inv(M).T)[:, :3]
mesh.data.vertices.foreach_set('co', coords.ravel()); mesh.data.update()
print('TORSO re-weighted', len(moved), 'vertices; tapered up to', TAPER, flush=True)

# --- slimmer sleeves ---------------------------------------------------------------------------------
# Meshy's oversized sweaters make the sleeves wide tubes that read as puffy next to the small hands. Each sleeve
# vertex moves part of the way to its arm bone, by how strongly it belongs to that bone, so the slimming fades out
# into the shoulder and the cuff on its own and the copies of a vertex at a UV seam (same position and weights)
# stay together. Hands, the face and long hair are left alone.
SLIM = {'Arm': .18, 'ForeArm': .1, 'ForeArmTwist': .1}
seg = {}
for side in ('Left', 'Right'):
    seg[f'{side}Arm'] = (world(D[f'{side}Arm'].head_local), world(D[f'{side}ForeArm'].head_local))
    seg[f'{side}ForeArm'] = (world(D[f'{side}ForeArm'].head_local), world(D[f'{side}Hand'].head_local))
    seg[f'{side}ForeArmTwist'] = seg[f'{side}ForeArm']
group_name = {g.index: g.name for g in mesh.vertex_groups}
rigid_set = set(rigid)
shift = np.zeros_like(pos)
for v in mesh.data.vertices:
    if v.index in rigid_set: continue
    p = Vector(pos[v.index])
    for g in v.groups:
        n = group_name[g.group]
        if n not in seg or g.weight < 1e-3: continue
        a, b = seg[n]; ab = b - a
        closest = a + ab * min(max((p - a).dot(ab) / ab.length_squared, 0), 1)
        shift[v.index] += np.array(closest - p) * g.weight * SLIM[n.replace('Left', '').replace('Right', '')]
pos += shift
coords = (np.c_[pos, np.ones(len(pos))] @ np.linalg.inv(M).T)[:, :3]
mesh.data.vertices.foreach_set('co', coords.ravel()); mesh.data.update()
print('SLEEVES slimmed', int((np.abs(shift).sum(1) > 1e-5).sum()), 'vertices', flush=True)

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
    bend(con, pb, want)
    return con


def bend(con, pb, want):
    best = (1e9, 0)
    for i in range(48):  # find the pole angle that bends the joint where we want it
        con.pole_angle = -math.pi + i * math.tau / 48; bpy.context.view_layer.update()
        cost = ((W() @ pb.head) - Vector(want)).length_squared
        if cost < best[0]: best = (cost, con.pole_angle)
    con.pole_angle = best[1]; bpy.context.view_layer.update()


for bone in ('Spine02', 'Spine01', 'Spine'): rotate_world(bone, (1, 0, 0), math.radians(-5))  # lean in towards the screen
rotate_world('Head', (1, 0, 0), math.radians(-6))                                              # look at the screen
shoulder = {s: world(D[f'{s}Arm'].head_local) for s in ('Left', 'Right')}
upper = (D['LeftArm'].head_local - D['LeftForeArm'].head_local).length * arm.scale.x
fore = (D['LeftForeArm'].head_local - D['LeftHand'].head_local).length * arm.scale.x
leg_len = (D['LeftUpLeg'].head_local - D['LeftLeg'].head_local).length * arm.scale.x
shin = (D['LeftLeg'].head_local - D['LeftFoot'].head_local).length * arm.scale.x
ankle_z = max(.09 * scale, HIP_Z - shin)  # feet down, as low as the shin allows (chibi feet may hang)
wrists, tips, elbows = {}, {}, {}
for side, sign in (('Left', 1), ('Right', -1)):
    knee_y = -leg_len * .95
    target = empty(f'{side} ankle', (sign * .1 * scale, knee_y - .02, ankle_z))
    ik(f'{side}Leg', target, empty(f'{side} knee pole', (sign * .12, -1.0, HIP_Z + .2)), (sign * .1, knee_y, HIP_Z + .02))
    # Typing posture: the upper arm hangs down and a little forward with the elbow by the body, and the
    # forearm runs forward to the keys, about level. Short chibi arms angle the upper arm further forward
    # so the forearm never climbs to the keyboard from below the desk.
    sh = shoulder[side]; wz = DESK_Z + .04
    # Elbow a little forward of the body, but never below the desk top: the forearms rest on the desk.
    ez = max(sh.z - upper * .92, DESK_Z + .04 * scale ** 1.5)  # chibi sleeves are puffier
    out = .04 * scale
    elbow = sh + Vector((sign * out, -math.sqrt(max(0, upper ** 2 - (ez - sh.z) ** 2 - out ** 2)), ez - sh.z))
    wx = sign * (.13 if 'chibi' in name else .115)  # hands a shoulder-width-ish apart on the keyboard, not crossing (big chibi thumbs would meet)
    wy = elbow.y - math.sqrt(max(.01, fore ** 2 - (wz - ez) ** 2 - (wx - elbow.x) ** 2))
    wrist = empty(f'{side} wrist', (wx, wy, wz))
    elbows[side] = (ik(f'{side}ForeArm', wrist, empty(f'{side} elbow pole', (sign * .4, .1, sh.z - .1)), elbow), elbow)
    wrists[side] = wrist
    # The hand carries on along the forearm, knuckles raised a little: the heel of the palm rests on the
    # laptop and the fingers arch down to the keys.
    bpy.context.view_layer.update()
    along = wrist.location - world(P[f'{side}ForeArm'].head); along.z = 0
    along = along.normalized() + Vector((0, -1, 0)); along.normalize(); along.z = .3  # halfway to straight ahead
    tips[side] = empty(f'{side} fingertips', wrist.location + along.normalized() * .12)
    con = P[f'{side}Hand'].constraints.new('DAMPED_TRACK'); con.target = tips[side]
    con.track_axis = 'TRACK_Y'
bpy.context.view_layer.update()


def roll_palm(side, want):
    """Roll a hand about its own length until its palm faces `want` (a world direction)."""
    pb, rot = P[f'{side}Hand'], W().to_3x3().normalized()
    def error():
        bpy.context.view_layer.update()
        length = (rot @ (pb.tail - pb.head)).normalized()
        have = rot @ (pb.matrix.to_3x3() @ palm_rest[side]); have -= length * have.dot(length)
        aim = want - length * want.dot(length)
        return have.angle(aim, 0) * (1 if have.cross(aim).dot(length) > 0 else -1)
    for _ in range(8):
        angle = error()
        if abs(angle) < .01: break
        start = pb.rotation_quaternion.copy()
        pb.rotation_quaternion = start @ Quaternion((0, 1, 0), angle)
        if abs(error()) > abs(angle): pb.rotation_quaternion = start @ Quaternion((0, 1, 0), -angle)
        # The forearm's twist bone takes the same roll, so the turn runs up the forearm and the cuff stays round.
        q = pb.rotation_quaternion
        P[f'{side}ForeArmTwist'].rotation_quaternion = Quaternion((0, 1, 0), 2 * math.atan2(q.y, q.w))



# --- typing loop (8 s at 30 fps), keyed through the controls, then baked to plain bone keys ------------
scene.render.fps = 30; scene.frame_start, scene.frame_end = 1, 241
base = {b: P[b].rotation_quaternion.copy() for b in ('Spine', 'Spine01', 'Head')}
axis = {b: P[b].matrix.to_quaternion().inverted() @ Vector((1, 0, 0)) for b in base}
finger_axis = {s: P[f'{s}Fingers1'].matrix.to_quaternion().inverted() @ Vector((1, 0, 0)) for s in ('Left', 'Right')}
SPLIT = {'Fingers1': 1, 'Fingers2': .8}  # how a finger's curl shares out between its two joints
LIFT = .3                                # how far a typing finger lifts off its key
RELAXED_CURL = .3                        # resting curl of the fingers on the keys
curl_sign = {}


def find_curl_sign(side):
    """Rigs disagree on which way round the finger axis bends the fingers down (ask once the palm faces down)."""
    tip_z = {}
    for k in (1, -1):
        P[f'{side}Fingers1'].rotation_quaternion = Quaternion(finger_axis[side], .4 * k); bpy.context.view_layer.update()
        tip_z[k] = world(P[f'{side}Fingers2'].tail).z
    curl_sign[side] = min(tip_z, key=tip_z.get)
curl = lambda side, bone, amount: Quaternion(finger_axis[side], curl_sign[side] * amount * SPLIT[bone])
# The laptop (build_furniture.py, scaled per cast): a 13 mm base whose keys stand 1.3 mm proud of it.
PALM_REST_Z = DESK_Z + .013 * LAPTOP_SCALE
KEYS_Z = PALM_REST_Z + .0013 * LAPTOP_SCALE


def lowest(ids):
    bpy.context.view_layer.update()
    ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    return min((mesh.matrix_world @ ev.vertices[i].co).z for i in ids)


def group_ids(side, bones, weight):
    groups = {mesh.vertex_groups[f'{side}{b}'].index for b in bones}
    return [v.index for v in mesh.data.vertices if any(g.group in groups and g.weight > weight for g in v.groups)]


# Rest each palm on the laptop, then curl the fingers until their tips just touch the keys. Typing lifts the
# fingers off the keys and drops them back, so they never sink in, and the palm stays where it rests.
rest = {}


def rest_palm(side, palm):
    """Roll the palm down and lower (or lift) the hand until its heel sits on the palm rest."""
    roll_palm(side, Vector((0, 0, -1)))
    for _ in range(6):
        drop = lowest(palm) - (PALM_REST_Z + .001)
        if abs(drop) < .0005: break
        wrists[side].location.z -= drop; tips[side].location.z -= drop


def forearm_sink(side, arm_ids):
    """How far the arm dips below the desk top where it is over the desk (in front of the desk edge)."""
    bpy.context.view_layer.update()
    ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    edge_y = wrists[side].location.y + DESK_BACK
    over = [p.z for p in (mesh.matrix_world @ ev.vertices[i].co for i in arm_ids) if p.y < edge_y]
    return DESK_Z + .002 - min(over) if over else 0


for side in ('Left', 'Right'):
    palm, tips_ids = group_ids(side, ('Hand',), .6), group_ids(side, ('Fingers2',), .5)
    arm_ids = group_ids(side, ('Arm', 'ForeArm'), .5)
    con, want = elbows[side]
    rest_palm(side, palm); find_curl_sign(side)

    def touch():
        """Rest the palm, then find the finger curl (radians) at which the fingertips meet the keys."""
        rest_palm(side, palm)
        lo, hi = -.6, 1.6
        for _ in range(14):
            mid = (lo + hi) / 2
            for bone in SPLIT: P[side + bone].rotation_quaternion = curl(side, bone, mid)
            lo, hi = (mid, hi) if lowest(tips_ids) > KEYS_Z + .0008 else (lo, mid)
        return lo

    def tilt():
        """Hands differ (chibi fingers droop): tip the hand at the knuckles until a relaxed curl reaches the keys."""
        lo, hi = -.08, .12
        for _ in range(10):
            mid = (lo + hi) / 2
            tips[side].location.z = wrists[side].location.z + mid
            lo, hi = (lo, mid) if touch() > RELAXED_CURL else (mid, hi)
        tips[side].location.z = wrists[side].location.z + (lo + hi) / 2

    # Palm on the laptop, forearm on the desk (not in it) and a relaxed curl: each change moves the others.
    for _ in range(4):
        tilt()
        sink = forearm_sink(side, arm_ids)
        if sink < .002: break
        want = want + Vector((0, 0, sink * 1.3)); bend(con, P[f'{side}ForeArm'], want)
    rest[side] = touch()
    print('HAND', side, 'palm', round(lowest(palm), 4), 'finger curl', round(rest[side], 3),
          'forearm sink', round(max(forearm_sink(side, arm_ids), 0), 4), flush=True)
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
        wrists[side].location = wrist_base[side]  # the palm stays on the laptop
        wrists[side].keyframe_insert('location', frame=frame)
        for bone in SPLIT:
            P[side + bone].rotation_quaternion = curl(side, bone, rest[side] - LIFT * tap * burst)
            P[side + bone].keyframe_insert('rotation_quaternion', frame=frame, group=side + bone)
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
arm_bones = [f'{wave_side}Arm', f'{wave_side}ForeArm', hand, 'Head', 'neck'] + fingers
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


# A small, friendly wave with the near hand: the elbow out and a little low and the hand at about shoulder
# height, rocking across the camera's view with the palm open towards it.
for frame, swing in ((12, 0), (19, 1), (26, -1), (33, 1), (40, -1), (47, 1), (54, -1), (62, 0)):
    for b in arm_bones: P[b].rotation_quaternion = start[b]
    bpy.context.view_layer.update()
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

# --- armpit slivers -----------------------------------------------------------------------------------
# Meshy's meshes carry thin flaps at the armpits (folds and hair ends tucked between arm and body). Hidden at rest,
# the typing pose stretches them into dark shards cutting out of the sweater. Faces near shoulder height that the
# pose stretches to more than six times their rest area are those flaps (real sweater faces stretch two or three
# times at most), so they are deleted.
import bmesh
scene.frame_set(1); bpy.context.view_layer.update()
ev = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
posed = np.array([tuple(v.co) for v in ev.data.vertices]); rest = np.array([tuple(v.co) for v in mesh.data.vertices])
tris = np.array([pl.vertices[:3] for pl in mesh.data.polygons])
area = lambda P: np.linalg.norm(np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]]), axis=1)
stretch = area(posed) / np.maximum(area(rest), 1e-12)
shoulder_mz = (mesh.matrix_world.inverted() @ world(D['LeftArm'].head_local)).z
near = np.abs(rest[tris].mean(1)[:, 2] - shoulder_mz) < .15 * local
slivers = np.flatnonzero((stretch > 6) & near)
bm = bmesh.new(); bm.from_mesh(mesh.data); bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in slivers.tolist()], context='FACES_ONLY')
bm.to_mesh(mesh.data); bm.free(); mesh.data.update()
print('SLIVERS removed', len(slivers), 'armpit faces', flush=True)

# --- export -------------------------------------------------------------------------------------
arm.animation_data.action = typing
for action in (typing, wave): action.use_fake_user = True
track = arm.animation_data.nla_tracks.new(); track.strips.new('Wave', 1, wave); track.mute = True
scene.frame_set(1); bpy.context.view_layer.update()
out = ROOT / 'generated'; out.mkdir(exist_ok=True)
wrist_mid = (wrist_base['Left'] + wrist_base['Right']) / 2
meta = {'name': name, 'seat': seat, 'scale': scale, 'height_m': height * 1, 'hip_z': HIP_Z,
        'wrist_mid': list(wrist_mid), 'rigid_vertices': len(rigid), 'wave_hand': wave_side, 'laptop_scale': LAPTOP_SCALE,
        'laptop_inset': LAPTOP_INSET}
(out / f'{name}-seated.json').write_text(json.dumps(meta, indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'{name}-seated.blend'))
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out / f'{name}-seated.glb'), export_format='GLB', use_selection=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_skins=True, export_yup=True)
print('SEATED', json.dumps(meta), flush=True)
