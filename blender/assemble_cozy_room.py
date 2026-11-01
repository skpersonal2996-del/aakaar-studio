"""Assemble the new cozy room: Blender-built furniture plus Meshy models replace the old web furniture.

Starts from the dressed studio-cozy.blend and saves blender/studio-assembled.blend. The old pieces
are removed and the new ones are placed where they stood, so the desk, chairs and laptops line up
with the seated characters. Inputs: furniture-library.blend (build_furniture.py) and the Meshy
GLBs in blender/source/meshy/ (meshy_batch.sh).

blender --background --python-exit-code 1 --python blender/assemble_cozy_room.py
"""
import bpy, bmesh, math
import numpy as np
from pathlib import Path
from mathutils import Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')
MESHY = ROOT / 'source/meshy'
PH = ROOT / 'source/polyhaven'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'studio-cozy.blend'))
scene = bpy.context.scene
O = bpy.data.objects
col = bpy.data.collections.new('06 · Assembled'); scene.collection.children.link(col)
layer = bpy.context.view_layer.layer_collection.children[col.name]


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


def bbox(objs):
    pts = [m.matrix_world @ Vector(c) for m in objs if m.type == 'MESH' for c in m.bound_box]
    return Vector(map(min, *pts)), Vector(map(max, *pts))


def emits(o):
    return any(s.material and s.material.node_tree and s.material.node_tree.nodes.get('Emission')
               and not s.material.node_tree.nodes.get('Principled BSDF') for s in o.material_slots)


def remove(name, keep_glows=False):
    for o in reversed(tree(O[name])):
        if keep_glows and o.type == 'MESH' and emits(o):
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw; continue
        bpy.data.objects.remove(o, do_unlink=True)


# Remember where the framed prints hung before removing them.
frames = {n: bbox(tree(O[n])) for n in ('Art print', 'Poster')}

# --- remove the old pieces --------------------------------------------------------------------
old = ['Node_236', 'Node_265', 'Node_294', 'Node_305', 'Node_316',          # desk, chairs, laptops
       'Node_336', 'Node_342', 'Node_360', 'Pendants', 'Rug · desk',          # mugs, pencil cup, pendants, rug
       'Node_106', 'Node_123',                                                # sofa, globe floor lamp
       'Plant · banana', 'Plant · fiddle', 'Plant · lounge', 'Art print', 'Poster']
for n in old: remove(n)
# Shelf, credenza and cabinet bodies only: the books, lamps, plants and LED strips on them stay.
for n in ['Mesh_83', 'Mesh_84', 'Mesh_85', 'Mesh_86', 'Mesh_446', 'Mesh_447', 'Mesh_448', 'Mesh_449', 'Mesh_450',
          'Mesh_451', 'Mesh_512', 'Mesh_513', 'Mesh_514', 'Mesh_515', 'Mesh_516', 'Mesh_517']:
    if n in O: bpy.data.objects.remove(O[n], do_unlink=True)
for n in ['Node_129', 'Node_132', 'Node_135', 'Node_138', 'Node_141']: remove(n, keep_glows=True)  # shelf boards

# --- Blender-built furniture ------------------------------------------------------------------
LIB = ROOT / 'furniture-library.blend'


def furniture(name, loc, rot=0.0, scale=(1, 1, 1), copy=False):
    with bpy.data.libraries.load(str(LIB), link=False) as (src, dst): dst.collections = [name]
    piece = dst.collections[0]; col.children.link(piece)
    root = next(o for o in piece.objects if o.parent is None and o.type == 'EMPTY')
    root.location = loc; root.rotation_euler.z = rot; root.scale = scale
    return root


furniture('Desk · walnut and steel', (.2, -.9, 0))
for x in (-.85, -.2, .45): furniture('Pendant · black drum', (x, -.9, 3.6))
furniture('Rug · jute', (.2, -1.1, 0), scale=(4.4 / 3.0, 2.6 / 2.2, 1))
furniture('Open shelf · walnut', (.75, 2.35, 0))
furniture('Credenza · black oak', (2.85, 2.275, 0))
furniture('Cabinet · black oak', (4.42, 1.0, 0), rot=-math.pi / 2)  # faces into the room from the right wall
furniture('Floor lamp · arc', (-.05, 2.15, 0), rot=math.radians(35))
for name, (lo, hi) in frames.items():
    furniture({'Art print': 'Wall art · framed', 'Poster': 'Poster · framed'}[name],
              ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))

# --- Meshy models -----------------------------------------------------------------------------


def meshy(file, label, loc, height=None, width=None, rot=0.0, tilt=0.0, path=None):
    """Import a Meshy GLB (or the glTF at `path`) under a root at its base centre, sized by height or by its longer side."""
    bpy.context.view_layer.active_layer_collection = layer
    before = set(O)
    bpy.ops.import_scene.gltf(filepath=str(path or MESHY / f'{file}.glb'))
    new = [o for o in O if o not in before]
    bpy.context.view_layer.update()
    lo, hi = bbox(new)
    root = O.new(label, None); col.objects.link(root)
    root.location = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
    bpy.context.view_layer.update()  # the root's matrix must be current before parenting to it
    for o in new:
        if o.parent is None:
            mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
    size = hi - lo
    k = height / size.z if height else width / max(size.x, size.y)
    root.location = loc; root.scale = (k,) * 3; root.rotation_euler = (tilt, 0, rot)
    return root


meshy('office-chair', 'Office chair · Vinay', (-1.5, -1.05, 0), height=.98, rot=math.pi / 2)
meshy('office-chair', 'Office chair · Shruti', (1.9, -.78, 0), height=.98, rot=-math.pi / 2)
meshy('laptop', 'Laptop · Vinay', (-.86, -1.05, .765), width=.31, rot=-math.pi / 2)
meshy('laptop', 'Laptop · Shruti', (1.26, -.78, .765), width=.31, rot=math.pi / 2)
meshy('mug', 'Mug · Vinay', (-.52, -1.42, .765), height=.095, rot=.6)
meshy('mug', 'Mug · Shruti', (.9, -1.22, .765), height=.095, rot=2.4)
meshy('pencil-cup', 'Pencil cup', (.42, -1.15, .765), height=.18)
meshy('book-stack', 'Book stack · desk', (-.24, -.52, .765), height=.09, rot=.15)
sofa = meshy('sofa', 'Sofa · grey sectional', (-2.4, 1.3, 0), width=3.6)
bpy.context.view_layer.update()
lo, hi = bbox(tree(sofa))
sofa.location.y += 2.53 - hi.y  # back against the back wall
bpy.context.view_layer.update(); lo, hi = bbox(tree(sofa))
seat = lo.z + (hi.z - lo.z) * .55
for file, x in (('orange-cushion', -3.65), ('gingham-cushion', -2.9), ('orange-cushion', -1.2)):
    meshy(file, f'Cushion · {file.split("-")[0]}', (x, hi.y - .62, seat - .08), width=.5, tilt=math.radians(-18))  # leaning on the backrest
meshy('knitted-throw', 'Throw · knitted', (-.8, 1.8, .735), width=.5, rot=1.5)  # folded over the right arm
meshy('large-plant', 'Plant · large corner', (4.25, 2.15, 0), height=1.6, rot=.5)
meshy('floor-plant', 'Plant · floor right', (4.1, -.45, 0), height=1.2, rot=1.2)
meshy('large-plant', 'Plant · large lounge', (-3.75, -1.55, 0), height=1.5, rot=2.1)
meshy('large-plant', 'Plant · banana by the sofa', (-.4, 2.22, 0), height=2.25, rot=-.4)  # the board's tall banana leaves
meshy(None, 'Fern · open shelf top', (.45, 2.36, 2.175), height=.36, path=PH / 'fern_02/fern_02_1k.gltf')
meshy(None, 'Fern · open shelf', (1.0, 2.36, 1.135), height=.3, rot=1.4, path=PH / 'fern_02/fern_02_1k.gltf')


def tint(root, rgb):
    """Multiply a Meshy model's base-colour texture (in place, packed into the file)."""
    images = set()
    for o in tree(root):
        for s in o.material_slots:
            p = s.material and s.material.node_tree and s.material.node_tree.nodes.get('Principled BSDF')
            n = p and p.inputs['Base Color'].is_linked and p.inputs['Base Color'].links[0].from_node
            while n and n.type != 'TEX_IMAGE':
                n = next((i.links[0].from_node for i in n.inputs if i.is_linked), None)
            if n: images.add(n.image)
    assert images, 'no base colour texture to tint'
    for img in images:
        px = np.empty(len(img.pixels), np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
        px[:, :3] *= rgb; img.pixels.foreach_set(px.ravel()); img.pack()


tint(sofa, (.62, .57, .52))  # Meshy made it near white; the board's sofa is a warm grey

# --- warm LED strips under the open shelf's boards (lit in lookdev_cozy.py) --------------------
led = bpy.data.materials.new('LED strip · warm'); led.use_nodes = True
nt = led.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.name = 'Emission'
em.inputs['Color'].default_value = (1, .5, .2, 1); em.inputs['Strength'].default_value = 12
nt.links.new(em.outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
for i, top in enumerate((.62, 1.13, 1.65, 2.17)):
    me = bpy.data.meshes.new(f'LED strip · open shelf {i + 1}'); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(.84, .012, .006), verts=bm.verts); bm.to_mesh(me); bm.free()
    me.materials.append(led)
    strip = O.new(me.name, me); col.objects.link(strip); strip.location = (.75, 2.24, top - .025 - .004)

# --- surfaces ---------------------------------------------------------------------------------
with bpy.data.libraries.load(str(LIB), link=False) as (src, dst): dst.materials = ['Oak floor']
O['Floor'].data.materials.clear(); O['Floor'].data.materials.append(dst.materials[0])

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'studio-assembled.blend'))
print('ASSEMBLED', len(col.all_objects), flush=True)
