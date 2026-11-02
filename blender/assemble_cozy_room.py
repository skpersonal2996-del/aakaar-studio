"""Assemble the room: Blender-built furniture plus Meshy models replace the old web furniture.

Two layouts share the furniture: 'cozy' starts from the dressed studio-cozy.blend (the smaller rearranged
room) and saves studio-assembled.blend; 'spacious' starts from studio-spacious.blend (the first site's
12 m × 10 m room, build_spacious_room.py) and saves studio-spacious-assembled.blend. The old pieces are
removed and the new ones are placed where they stood, so the desk, chairs and laptops line up with the
seated characters. Inputs: furniture-library.blend (build_furniture.py), bookshelf-library.blend
(build_bookshelf.py, spacious only) and the Meshy GLBs in blender/source/meshy/ (meshy_batch.sh).

blender --background --python-exit-code 1 --python blender/assemble_cozy_room.py [-- cozy|spacious]
"""
import bpy, bmesh, math, sys
import numpy as np
from pathlib import Path
from mathutils import Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')
MESHY = ROOT / 'source/meshy'
PH = ROOT / 'source/polyhaven'
SPACIOUS = (sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'cozy') == 'spacious'
bpy.ops.wm.open_mainfile(filepath=str(ROOT / ('studio-spacious.blend' if SPACIOUS else 'studio-cozy.blend')))
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
SHELF_LIB = ROOT / 'bookshelf-library.blend'
if SPACIOUS: old += ['Plant · trailing'] + (['Bookshelf'] if SHELF_LIB.exists() else [])  # bamboo palm; the old bookshelf
for n in old: remove(n)
if SPACIOUS:  # the first site's low-poly desk pot and its near-black succulent: they look broken up close
    # and its plain bottle cylinders (with the cap, Mesh_258, that floated once they were gone) and box books (the
    # Meshy book stack stands beside them)
    for n in ['Mesh_234'] + [f'Mesh_{i}' for i in range(235, 247)] + ['Mesh_257', 'Mesh_258', 'Mesh_259', 'Mesh_260', 'Mesh_263', 'Mesh_264', 'Mesh_265']:
        if n in O: bpy.data.objects.remove(O[n], do_unlink=True)
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
if SPACIOUS:  # where the first site had them, under a 4.2 m ceiling
    for x in (-.85, -.2, .45): furniture('Pendant · black drum · long', (x, -.9, 4.2))
    furniture('Rug · jute', (.2, -.9, 0), scale=(5.2 / 3.0, 3.0 / 2.2, 1))
    OPEN_SHELF = (-.95, 4.75)
    furniture('Credenza · black oak', (1.9, 4.68, 0))
    furniture('Cabinet · black oak', (4.85, 4.72, 0))  # under the ID wall
    furniture('Floor lamp · arc', (-1.62, 4.4, 0), rot=.35)
    if SHELF_LIB.exists():
        with bpy.data.libraries.load(str(SHELF_LIB), link=False) as (src, dst): dst.collections = ['Bookshelf · built-in']
        col.children.link(dst.collections[0])
else:
    for x in (-.85, -.2, .45): furniture('Pendant · black drum', (x, -.9, 3.6))
    furniture('Rug · jute', (.2, -1.1, 0), scale=(4.4 / 3.0, 2.6 / 2.2, 1))
    OPEN_SHELF = (.75, 2.35)
    furniture('Credenza · black oak', (2.85, 2.275, 0))
    furniture('Cabinet · black oak', (4.42, 1.0, 0), rot=-math.pi / 2)  # faces into the room from the right wall
    furniture('Floor lamp · arc', (-.05, 2.15, 0), rot=math.radians(35))
furniture('Open shelf · walnut', (*OPEN_SHELF, 0))
# Laptops: Blender-built (the Meshy one's texture breaks into speckles at web resolution). Their keyboards
# face each seat; place_characters.py moves them to each character pair's hands.
furniture('Laptop · aluminium', (-.86, -1.05, .765), rot=-math.pi / 2).name = 'Laptop · Vinay'
furniture('Laptop · aluminium', (1.26, -.78, .765), rot=math.pi / 2).name = 'Laptop · Shruti'
# In the spacious room the two prints swap: the 'Good design' poster above the sofa, the abstract art by the shelf.
prints = {'Art print': 'Poster · framed', 'Poster': 'Wall art · framed'} if SPACIOUS else \
    {'Art print': 'Wall art · framed', 'Poster': 'Poster · framed'}
for name, (lo, hi) in frames.items():
    frame = furniture(prints[name], ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.context.view_layer.update(); flo, fhi = bbox(tree(frame))
    frame.scale = ((hi.z - lo.z) / (fhi.z - flo.z),) * 3  # fills the old print's height

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
meshy('mug', 'Mug · Vinay', (-.52, -1.42, .765), height=.095, rot=.6)
meshy('mug', 'Mug · Shruti', (.9, -1.22, .765), height=.095, rot=2.4)
meshy('pencil-cup', 'Pencil cup', (.42, -1.15, .765), height=.18)
meshy('book-stack', 'Book stack · desk', (-.24, -.52, .765), height=.09, rot=.15)
# The L-sectional: back to the back wall, its chaise along the left wall in the spacious room.
sofa = meshy('sofa', 'Sofa · grey sectional', (-4.0, 4.4, 0) if SPACIOUS else (-2.4, 1.3, 0), width=3.9 if SPACIOUS else 3.6)
bpy.context.view_layer.update()
lo, hi = bbox(tree(sofa))
sofa.location.y += (4.97 if SPACIOUS else 2.53) - hi.y  # back against the back wall
bpy.context.view_layer.update(); lo, hi = bbox(tree(sofa))
seat, w = lo.z + (hi.z - lo.z) * .55, hi.x - lo.x
for file, f in (('orange-cushion', .153), ('gingham-cushion', .361), ('orange-cushion', .833)):
    meshy(file, f'Cushion · {file.split("-")[0]}', (lo.x + w * f, hi.y - .62, seat - .08), width=.5, tilt=math.radians(-18))  # leaning on the backrest
meshy('knitted-throw', 'Throw · knitted', (hi.x - .2, hi.y - .73, .735), width=.5, rot=1.5)  # folded over the right arm
sx, sy = OPEN_SHELF
if SPACIOUS:
    meshy('large-plant', 'Plant · large corner', (3.8, 4.45, 0), height=2.0, rot=.5)          # beside the ID wall
    meshy('floor-plant', 'Plant · floor right', (5.45, .35, 0), height=1.9, rot=1.2)          # beside the window
    meshy('large-plant', 'Plant · large lounge', (-5.35, .98, 0), height=1.6, rot=2.1)        # at the end of the bookshelf
    meshy('large-plant', 'Plant · banana by the sofa', (-.15, 4.42, 0), height=2.25, rot=-.4)
else:
    meshy('large-plant', 'Plant · large corner', (4.25, 2.15, 0), height=1.6, rot=.5)
    meshy('floor-plant', 'Plant · floor right', (4.1, -.45, 0), height=1.2, rot=1.2)
    meshy('large-plant', 'Plant · large lounge', (-3.75, -1.55, 0), height=1.5, rot=2.1)
    meshy('large-plant', 'Plant · banana by the sofa', (-.4, 2.22, 0), height=2.25, rot=-.4)  # the board's tall banana leaves
meshy(None, 'Fern · open shelf top', (sx - .3, sy + .01, 2.175), height=.36, path=PH / 'fern_02/fern_02_1k.gltf')
meshy(None, 'Fern · open shelf', (sx + .25, sy + .01, 1.135), height=.3, rot=1.4, path=PH / 'fern_02/fern_02_1k.gltf')


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
    strip = O.new(me.name, me); col.objects.link(strip); strip.location = (sx, sy - .11, top - .025 - .004)

# --- surfaces ---------------------------------------------------------------------------------
with bpy.data.libraries.load(str(LIB), link=False) as (src, dst): dst.materials = ['Oak floor']
O['Floor'].data.materials.clear(); O['Floor'].data.materials.append(dst.materials[0])

# --- the desk top is lower than the first site's (build_furniture.py DESK_TOP): bring down what stands on it ---------
DESK_DROP = .765 - .68
on_desk = []
for o in O:
    if o.type != 'MESH' or o.name.startswith(('Desk ·', 'Top', 'Leg', 'Top rail', 'Foot rail', 'Apron', 'Stretcher')): continue
    root = o
    while root.parent: root = root.parent
    if root.name.startswith('Desk ·'): continue
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    cx, cy, zmin = sum(p.x for p in pts) / 8, sum(p.y for p in pts) / 8, min(p.z for p in pts)
    if .755 < zmin < .80 and -1.15 < cx < 1.55 and -1.6 < cy < -.2: on_desk.append(o)
for o in on_desk:
    m = o.matrix_world.copy(); m.translation.z -= DESK_DROP; o.matrix_world = m
print('ASSEMBLE desk props lowered', len(on_desk), flush=True)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / ('studio-spacious-assembled.blend' if SPACIOUS else 'studio-assembled.blend')))
print('ASSEMBLED', len(col.all_objects), flush=True)
