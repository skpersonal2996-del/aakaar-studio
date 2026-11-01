"""Hard-surface furniture for the cozy room, built in Blender at real size (metres, Z up).

Thin metal frames, flat panels and exact dimensions come out cleaner here than from Meshy. Each piece is
a root empty (origin on the floor, front facing -Y) in its own collection inside
blender/furniture-library.blend, ready to be linked or appended into studio-cozy.blend.
Design references: output/meshy-reference-assets-2026-10-31/design-references/ and textures/.

python3 blender/fetch_polyhaven_textures.py
blender --background --factory-startup --python-exit-code 1 --python blender/build_furniture.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
TEX = ROOT / 'source/polyhaven/textures'
ART = ROOT.parent / 'output/meshy-reference-assets-2026-10-31/textures'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# --- materials -------------------------------------------------------------------------------


def node_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes['Principled BSDF']


def pbr(name, asset, metres, tint=(1, 1, 1), rough=1.0, bump=1.0):
    """Poly Haven texture set, box-projected in object space so no UVs are needed."""
    m, nt, p = node_material(name)
    coords = nt.nodes.new('ShaderNodeTexCoord'); mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1 / metres,) * 3
    nt.links.new(coords.outputs['Object'], mapping.inputs['Vector'])

    def image(map_name, colour):
        node = nt.nodes.new('ShaderNodeTexImage'); node.projection = 'BOX'; node.projection_blend = .15
        node.image = bpy.data.images.load(str(TEX / asset / f'{map_name}.jpg'), check_existing=True)
        node.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
        nt.links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node

    tinted = nt.nodes.new('ShaderNodeMix'); tinted.data_type = 'RGBA'; tinted.blend_type = 'MULTIPLY'
    tinted.inputs['Factor'].default_value = 1; tinted.inputs['B'].default_value = (*tint, 1)
    nt.links.new(image('diff', True).outputs['Color'], tinted.inputs['A'])
    nt.links.new(tinted.outputs['Result'], p.inputs['Base Color'])
    scale = nt.nodes.new('ShaderNodeMath'); scale.operation = 'MULTIPLY'; scale.inputs[1].default_value = rough
    nt.links.new(image('rough', False).outputs['Color'], scale.inputs[0]); nt.links.new(scale.outputs[0], p.inputs['Roughness'])
    normal = nt.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = bump
    nt.links.new(image('nor_gl', False).outputs['Color'], normal.inputs['Color']); nt.links.new(normal.outputs[0], p.inputs['Normal'])
    return m


def flat(name, colour, rough=.5, metal=0.0):
    m, nt, p = node_material(name)
    p.inputs['Base Color'].default_value = (*colour, 1); p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    return m


def glow(name, colour, strength):
    """Emission only: the room bake treats these as lamps (lit, exported as HDR glow)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*colour, 1); em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs[0])
    return m


def picture(name, file):
    m, nt, p = node_material(name)
    node = nt.nodes.new('ShaderNodeTexImage'); node.image = bpy.data.images.load(str(ART / file), check_existing=True)
    nt.links.new(node.outputs['Color'], p.inputs['Base Color']); p.inputs['Roughness'].default_value = .8
    return m


WALNUT = pbr('Walnut', 'black_walnut_veneer_02', .9, tint=(.95, .8, .68), rough=.75)
BLACK_OAK = pbr('Black oak', 'black_oak_veneer', .9, tint=(.16, .15, .14), rough=.8, bump=.6)
JUTE = pbr('Jute', 'hessian_230', 1.1, tint=(.85, .62, .4), rough=1.0, bump=4.0)  # chunky 7 mm cords
FLOOR_OAK = pbr('Oak floor', 'oak_wood_planks', 2.0, tint=(.36, .22, .13), rough=.6)  # deep warm brown, as in the reference
FLOOR_OAK.use_fake_user = True  # unused in the library itself; saved so the room assembly can append it
STEEL = flat('Black steel', (.018, .018, .018), rough=.42, metal=.65)
BRASS = flat('Brushed brass', (.78, .55, .28), rough=.32, metal=1.0)
SHADE = flat('Cream shade', (.93, .87, .76), rough=.45)
BULB = glow('Lamp glow', (1, .78, .5), 12)
OAK_FRAME = pbr('Oak frame', 'black_walnut_veneer_02', .4, tint=(1.1, .95, .8), rough=.7)

# --- geometry helpers ------------------------------------------------------------------------


def soften(o, width=.003, segments=3):
    bev = o.modifiers.new('Soft edge', 'BEVEL'); bev.width = width; bev.segments = segments
    bev.limit_method = 'ANGLE'; bev.angle_limit = math.radians(35); bev.harden_normals = True
    for p in o.data.polygons: p.use_smooth = True
    return o


def box(name, size, loc, mat, parent, bevel=.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat); o.parent = parent
    return soften(o, bevel) if bevel else o


def cyl(name, radius, depth, loc, mat, parent, rot=(0, 0, 0), verts=32, bevel=.002):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name; o.data.materials.append(mat); o.parent = parent
    return soften(o, bevel) if bevel else o


def piece(name, x):
    """A root empty in its own collection; pieces are laid out along X for the preview."""
    col = bpy.data.collections.new(name); scene.collection.children.link(col)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[name]
    root = bpy.data.objects.new(name, None); col.objects.link(root); root.location = (x, 0, 0)
    return root


def finish(root):
    for o in root.children: o.matrix_parent_inverse = root.matrix_world.inverted()


# --- furniture -------------------------------------------------------------------------------


def desk(x, w=2.7, d=1.35, h=.765):
    """Walnut top on a black square-tube frame (03-wood-and-black-metal-desk)."""
    r = piece('Desk · walnut and steel', x)
    t, leg = .045, .05
    box('Top', (w, d, t), (x, 0, h - t / 2), WALNUT, r, .004)
    lx, ly = w / 2 - .6, d / 2 - .09  # trestles well in from the ends, clear of the seated people's feet
    for sx in (-1, 1):
        for sy in (-1, 1): box('Leg', (leg, leg, h - t), (x + sx * lx, sy * ly, (h - t) / 2), STEEL, r, .002)
        box('Top rail', (leg, 2 * ly, .04), (x + sx * lx, 0, h - t - .02), STEEL, r, .002)
        box('Foot rail', (leg, 2 * ly, .04), (x + sx * lx, 0, .12), STEEL, r, .002)
    for sy in (-1, 1): box('Apron', (2 * lx, .04, .04), (x, sy * ly, h - t - .02), STEEL, r, .002)
    box('Stretcher', (2 * lx, .04, .04), (x, 0, .12), STEEL, r, .002)  # joins the two foot rails
    finish(r); return r


def cabinet(x, w=1.7, d=.45, h=.66, doors=2, name='Cabinet · black oak'):
    """Low black cabinet with brass bar pulls (07-black-two-door-cabinet)."""
    r = piece(name, x)
    foot = .07
    box('Body', (w, d, h - foot), (x, 0, foot + (h - foot) / 2), BLACK_OAK, r, .012)
    dw = (w - .06) / doors
    for i in range(doors):
        cx = x - w / 2 + .03 + dw * (i + .5)
        box('Door', (dw - .008, .012, h - foot - .07), (cx, -d / 2 - .004, foot + (h - foot) / 2), BLACK_OAK, r, .003)
        side = 1 if i % 2 == 0 else -1
        cyl('Pull', .006, .17, (cx + side * (dw / 2 - .05), -d / 2 - .025, foot + (h - foot) / 2), BRASS, r, verts=16, bevel=0)
    for sx in (-1, 1):
        for sy in (-1, 1): box('Foot', (.04, .04, foot), (x + sx * (w / 2 - .06), sy * (d / 2 - .06), foot / 2), STEEL, r, .002)
    finish(r); return r


def shelf_unit(x, w, d, h, shelves, name, levels=None):
    """Black steel frame with walnut shelves (08 and 09 open shelving). `levels`: shelf-top heights."""
    r = piece(name, x)
    post, board = .025, .025
    for sx in (-1, 1):
        for sy in (-1, 1): box('Post', (post, post, h), (x + sx * (w / 2 - post / 2), sy * (d / 2 - post / 2), h / 2), STEEL, r, .0015)
    tops = levels or [.06 + board / 2 + i * (h - .1) / (shelves - 1) for i in range(shelves)]
    for top in tops:
        z = top - board / 2
        box('Shelf', (w - post * 2, d - .004, board), (x, 0, z), WALNUT, r, .003)
        for sy in (-1, 1): box('Rail', (w - post * 2, .015, .02), (x, sy * (d / 2 - .0075), z - board / 2 - .01), STEEL, r, .001)
        for sx in (-1, 1): box('Side rail', (.015, d - post * 2, .02), (x + sx * (w / 2 - .0075), 0, z - board / 2 - .01), STEEL, r, .001)
    finish(r); return r


def pendant(x, drop=1.2):
    """Black drum pendant with a glowing diffuser (10-black-cylinder-pendant-lamp). Origin = ceiling."""
    r = piece('Pendant · black drum', x)
    top = 0.0  # hangs below its origin; place the origin on the ceiling
    cyl('Canopy', .055, .025, (x, 0, top - .0125), STEEL, r, bevel=.003)
    cyl('Cord', .003, drop, (x, 0, top - .025 - drop / 2), STEEL, r, verts=8, bevel=0)
    cyl('Cap', .025, .05, (x, 0, top - .025 - drop - .025), STEEL, r, bevel=.003)
    shade = cyl('Drum', .11, .14, (x, 0, top - .025 - drop - .05 - .07), STEEL, r, verts=48, bevel=.004)
    solid = shade.modifiers.new('Wall', 'SOLIDIFY'); solid.thickness = .004
    shade.modifiers.move(1, 0)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(shade.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -.9], context='FACES')  # open underside
    bm.to_mesh(shade.data); bm.free()
    cyl('Diffuser', .1, .006, (x, 0, top - .025 - drop - .05 - .125), BULB, r, verts=48, bevel=0)
    finish(r); return r


def floor_lamp(x):
    """Arc floor lamp with a cream dome shade (11-curved-floor-lamp)."""
    r = piece('Floor lamp · arc', x)
    cyl('Base', .15, .025, (x, 0, .0125), STEEL, r, verts=48, bevel=.006)
    cyl('Pole', .011, 1.42, (x, 0, .025 + .71), STEEL, r, verts=16, bevel=0)
    curve = bpy.data.curves.new('Arc', 'CURVE'); curve.dimensions = '3D'; curve.bevel_depth = .011; curve.bevel_resolution = 4
    spline = curve.splines.new('BEZIER'); spline.bezier_points.add(1)
    a, b = spline.bezier_points
    a.co = (0, 0, 1.44); a.handle_left = (0, 0, 1.3); a.handle_right = (0, 0, 1.62)
    b.co = (0, -.32, 1.48); b.handle_left = (0, -.2, 1.68); b.handle_right = (0, -.38, 1.4)
    arc = bpy.data.objects.new('Arc', curve); bpy.context.collection.objects.link(arc)
    arc.location = (x, 0, 0); arc.data.materials.append(STEEL); arc.parent = r
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.15, location=(x, -.36, 1.38), segments=48, ring_count=24)
    dome = bpy.context.object; dome.name = 'Shade'; dome.parent = r
    import bmesh
    bm = bmesh.new(); bm.from_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.01], context='VERTS')  # keep the upper dome
    bm.to_mesh(dome.data); bm.free()
    dome.modifiers.new('Wall', 'SOLIDIFY').thickness = .006
    dome.data.materials.append(SHADE); soften(dome, .002)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.045, location=(x, -.36, 1.4))
    bulb = bpy.context.object; bulb.name = 'Bulb'; bulb.data.materials.append(BULB); bulb.parent = r
    finish(r); return r


def rug(x, w=3.0, d=2.2):
    """Chunky jute rug with fringed short ends (32-jute-area-rug)."""
    r = piece('Rug · jute', x)
    box('Rug', (w, d, .012), (x, 0, .006), JUTE, r, .004)
    strand = cyl('Fringe', .0025, .07, (x - w / 2 - .035, -d / 2 + .01, .004), JUTE, r, rot=(0, math.pi / 2, 0), verts=6, bevel=0)
    arr = strand.modifiers.new('Row', 'ARRAY'); arr.count = int((d - .02) / .012); arr.relative_offset_displace = (0, 0, 0)
    arr.use_relative_offset = False; arr.use_constant_offset = True; arr.constant_offset_displace = (0, .012, 0)
    mirror = strand.modifiers.new('Both ends', 'MIRROR'); mirror.use_axis = (True, False, False); mirror.mirror_object = r
    finish(r); return r


def framed(x, name, size, mat, frame_mat, frame=.035, depth=.03):
    """Framed print hanging flat against a wall (front faces -Y)."""
    r = piece(name, x)
    w, h = size
    # A plane keeps the whole image on one face (a box would show only part of it).
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, -.002, h / 2 + frame), rotation=(math.pi / 2, 0, 0))
    art = bpy.context.object; art.name = 'Print'; art.scale = (w, h, 1); art.data.materials.append(mat); art.parent = r
    for z in (frame / 2, h + frame * 1.5):
        box('Frame', (w + frame * 2, depth, frame), (x, .006, z), frame_mat, r, .002)
    for sx in (-1, 1):
        box('Frame', (frame, depth, h + frame * 2), (x + sx * (w / 2 + frame / 2), .006, h / 2 + frame), frame_mat, r, .002)
    finish(r); return r


# Layout for the preview, left to right.
desk(0)
cabinet(3.0, h=.71)  # ID-wall cabinet: top at the old 0.71 m, where its lamp and books sit
cabinet(5.6, w=2.9, h=.6, doors=3, name='Credenza · black oak')  # top at the old 0.6 m
shelf_unit(7.9, .8, .35, 1.8, 5, 'Bookshelf · narrow')
shelf_unit(9.0, .6, .35, 2.2, 6, 'Shelf · tall divider')
# Replaces the room's open shelf; shelf tops match the props already standing on it.
shelf_unit(19.0, .9, .34, 2.25, 5, 'Open shelf · walnut', levels=[.1, .62, 1.13, 1.65, 2.17])
p = pendant(10.0, drop=1.45); p.location.z = 2.9  # drum about 1.9 m above the floor under a 3.6 m ceiling
floor_lamp(10.9)
rug(13.0)
framed(15.3, 'Wall art · framed', (.95, 1.25), picture('Wall art', 'wall-art.png'), STEEL)
framed(16.6, 'Poster · framed', (.6, .83), picture('Poster', 'poster.png'), OAK_FRAME)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'furniture-library.blend'))
print('FURNITURE_COMPLETE', len(bpy.data.objects), flush=True)
