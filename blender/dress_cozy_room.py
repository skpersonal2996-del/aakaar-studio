"""Set dressing for studio-cozy.blend: CC0 Poly Haven props plus a few simple procedural pieces.

Fetch props first (python3 blender/fetch_polyhaven_props.py), then run after build_cozy_room.py:
blender --background blender/studio-cozy.blend --python-exit-code 1 --python blender/dress_cozy_room.py
"""
import bpy, bmesh, math
from pathlib import Path
from mathutils import Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')
PH = ROOT / 'source/polyhaven'
scene = bpy.context.scene
O = bpy.data.objects

col = bpy.data.collections.get('04 · Set dressing')
if col:
    for o in list(col.all_objects): bpy.data.objects.remove(o, do_unlink=True)
else:
    col = bpy.data.collections.new('04 · Set dressing'); scene.collection.children.link(col)
layer = bpy.context.view_layer.layer_collection.children[col.name]


def prop(asset, label, loc, keep=None, scale=1.0, turn=0.0, file=None, length=None):
    """Import a glTF prop, keep the named variant meshes, and stand it on `loc` (its base centre)."""
    bpy.context.view_layer.active_layer_collection = layer
    before = set(O)
    bpy.ops.import_scene.gltf(filepath=str(file or PH / asset / f'{asset}_1k.gltf'))
    new = [o for o in O if o not in before]
    for o in new:
        if o.type == 'MESH' and keep and not any(k in o.name for k in keep): bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in O if o not in before and o.type == 'MESH']
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
    root = O.new(label, None); col.objects.link(root)
    root.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
    bpy.context.view_layer.update()  # the root's matrix must be current before parenting to it
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
    for o in [o for o in O if o not in before and o.type == 'EMPTY' and o is not root]: bpy.data.objects.remove(o, do_unlink=True)
    if length: scale = length / max(hi.x - lo.x, hi.y - lo.y)  # unknown source units (Meshy)
    root.location = loc; root.scale = (scale,) * 3; root.rotation_euler.z = turn
    return root


# Open shelf (x 0.3..1.2, back y 2.5): boards at z 0.62, 1.13, 1.65, 2.17.
prop('book_encyclopedia_set_01', 'Books · open shelf', (.62, 2.36, 1.135), scale=.9)
prop('Camera_01', 'Vintage camera · open shelf', (.95, 2.33, 1.655), turn=math.radians(200), scale=1.1)
prop('ceramic_vase_01', 'Vase · open shelf', (.5, 2.36, .625), scale=.55)
prop('potted_plant_04', 'Succulent · open shelf', (.85, 2.36, 2.175), scale=1.1)
prop('planter_pot_clay', 'Clay pot · open shelf', (1.0, 2.36, .625), scale=.6)
# Credenza top (z 0.6) and floor around it.
prop('ceramic_vase_03', 'Vase · credenza', (2.05, 2.3, .6), scale=.85)
prop('potted_plant_02', 'Plant · credenza floor', (1.62, 1.75, 0), turn=math.radians(30))
# Desk (top z 0.77) and the front-right foreground.
prop('potted_plant_01', 'Plant · foreground right', (4.25, -4.45, 0), turn=math.radians(-40), scale=1.15)
prop('calathea_orbifolia_01', 'Calathea · sofa end', (-.32, 1.95, 0), keep=['_a'], scale=1.2)
def hide_tree(o):
    o.hide_render = o.hide_viewport = True
    for c in o.children: hide_tree(c)


if 'Plant · trailing' in O: hide_tree(O['Plant · trailing'])

# Neon diamond beside the ID wall, as in the reference.
glow = bpy.data.materials.new('Neon diamond'); glow.use_nodes = True
nt = glow.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (1, .35, .85, 1); em.inputs[1].default_value = 12
nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
tube = bpy.data.curves.new('Neon diamond', 'CURVE'); tube.dimensions = '3D'; tube.bevel_depth = .007; tube.bevel_resolution = 3
for pts, cyclic in [([(0, 0, .15), (0, .1, .04), (0, 0, -.15), (0, -.1, .04)], True), ([(0, -.1, .04), (0, .1, .04)], False)]:
    s = tube.splines.new('POLY'); s.points.add(len(pts) - 1); s.use_cyclic_u = cyclic
    for p, co in zip(s.points, pts): p.co = (*co, 1)
tube.materials.append(glow)
d = O.new('Neon diamond', tube); col.objects.link(d); d.location = (4.66, 2.2, 2.6)

meshy = ROOT / 'source/meshy/toy-car.glb'
if meshy.exists(): prop(None, 'Toy car · open shelf', (.52, 2.33, 1.655), file=meshy, length=.17, turn=math.radians(-25))

bpy.ops.wm.save_mainfile()
print('DRESSING_COMPLETE', len(col.all_objects), flush=True)
