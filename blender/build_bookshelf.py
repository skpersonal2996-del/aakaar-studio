"""Built-in walnut bookshelf for the left wall of the spacious studio room, filled with books, decor and LED strips.

Everything is modelled at its room position (Blender coordinates, metres: back panel on the wall at x -5.98, open
front facing +X at x -5.60, y -4.45..0.75, boards at z .08..2.96) under the root empty 'Bookshelf · built-in' at
the origin, in the collection of the same name in blender/bookshelf-library.blend: append the collection and it
is in place. The plain books are joined into one mesh per shelf (colours in a 'Book colour' attribute); the
titled books keep a printed spine atlas (rendered here with Cycles, packed into the file) on their own mesh per
shelf. LED strips and lamp shades are emission-only, so bake_cozy_room.py treats them as lamps. Seeded random.

blender --background --factory-startup --python-exit-code 1 --python blender/build_bookshelf.py
"""
import bpy, bmesh, colorsys, math, random, tempfile
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent
TEX = ROOT / 'source/polyhaven/textures'
PH = ROOT / 'source/polyhaven'
FONTS = Path('/System/Library/Fonts/Supplemental')
NAME = 'Bookshelf · built-in'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(1987)

# --- dimensions (room coordinates) -------------------------------------------------------------
BACK, FRONT, PANEL = -5.98, -5.60, .015
INNER = BACK + PANEL                                # front face of the back panel
BOARDS = [.08, .56, 1.04, 1.52, 2.0, 2.48, 2.96]    # board centres
BOARD, SIDE, LIP = .035, .035, .012                 # thicknesses; LIP: front edge band hiding the LEDs
Y0, Y1 = -4.45, .75
TOP = 3.12                                          # fascia and cap above the top board
POSTS = [Y0 + SIDE / 2, -3.15, -1.85, -.55, Y1 - SIDE / 2]  # end panels sit inside the footprint
BAYS = [(a + SIDE / 2, b - SIDE / 2) for a, b in zip(POSTS, POSTS[1:])]
RAIL_X, RAIL_Z = -5.54, 3.0
LED_STRENGTH = 60

# --- materials ---------------------------------------------------------------------------------


def node_material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes['Principled BSDF']


def pbr(name, asset, metres, tint=(1, 1, 1), rough=1.0, bump=1.0, upright=False):
    """Poly Haven texture set, box-projected in object space so no UVs are needed (as in build_furniture.py).
    Box projection runs the grain along Y on X- and Z-facing faces; `upright` turns it vertical on Y-facing ones."""
    m, nt, p = node_material(name)
    coords = nt.nodes.new('ShaderNodeTexCoord'); mapping = nt.nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1 / metres,) * 3
    if upright: mapping.inputs['Rotation'].default_value = (0, math.pi / 2, 0)
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


def mottled(m, attr=None, scale=90, depth=.12):
    """Matte, slightly worn surface: noise darkens the colour (from `attr` or the base colour) and varies roughness."""
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    coords = nt.nodes.new('ShaderNodeTexCoord'); noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale; noise.inputs['Detail'].default_value = 6
    nt.links.new(coords.outputs['Object'], noise.inputs['Vector'])
    shade = nt.nodes.new('ShaderNodeMapRange'); shade.inputs['To Min'].default_value = 1 - depth
    nt.links.new(noise.outputs['Fac'], shade.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    if attr:
        source = nt.nodes.new('ShaderNodeAttribute'); source.attribute_name = attr
        nt.links.new(source.outputs['Color'], mix.inputs['A'])
    else: mix.inputs['A'].default_value = p.inputs['Base Color'].default_value
    nt.links.new(shade.outputs['Result'], mix.inputs['B']); nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
    rough = nt.nodes.new('ShaderNodeMapRange'); base = p.inputs['Roughness'].default_value
    rough.inputs['To Min'].default_value = base - .08; rough.inputs['To Max'].default_value = min(1, base + .1)
    nt.links.new(noise.outputs['Fac'], rough.inputs['Value']); nt.links.new(rough.outputs['Result'], p.inputs['Roughness'])
    return m


def linear(hex_colour, jitter=0.0):
    """sRGB hex to linear RGB, optionally nudged in hue, saturation and value (for a less uniform shelf)."""
    c = [int(hex_colour.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    if jitter:
        h, s, v = colorsys.rgb_to_hsv(*c)
        h = (h + rng.uniform(-.015, .015) * jitter) % 1
        s = min(1, max(0, s * rng.uniform(1 - .15 * jitter, 1 + .1 * jitter)))
        v = min(1, max(0, v * rng.uniform(1 - .14 * jitter, 1 + .06 * jitter)))
        c = colorsys.hsv_to_rgb(h, s, v)
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c)


WOOD = pbr('Shelf walnut', 'black_walnut_veneer_02', .7, tint=(.34, .25, .2), rough=.6, bump=.6)
WOOD_UP = pbr('Shelf walnut · upright', 'black_walnut_veneer_02', .7, tint=(.34, .25, .2), rough=.6, bump=.6, upright=True)
BACK_WOOD = pbr('Shelf walnut · back', 'black_walnut_veneer_02', .8, tint=(.24, .18, .15), rough=.75, bump=.4)
BRASS = flat('Shelf brass', (.78, .55, .28), rough=.3, metal=1.0)
LED = glow('Shelf LED · warm', (1, .62, .32), LED_STRENGTH)
CLOTH = mottled(flat('Book cloth', (1, 1, 1), rough=.82), attr='Book colour')
CLOTH.node_tree.nodes['Principled BSDF'].inputs['Sheen Weight'].default_value = .25
PAGES = mottled(flat('Book pages', linear('#e9dfc8'), rough=.9), scale=160, depth=.1)

# --- titled books: spine atlas -------------------------------------------------------------------

TITLES = {  # from the old three.js shelf (Bookshelf.jsx)
    'meluha': ('The Immortals of Meluha', 'AMISH', '#7a2a1c', '#f3c87a', True),
    'nagas': ('The Secret of the Nagas', 'AMISH', '#1f4a3a', '#f3c87a', True),
    'vayu': ('The Oath of the Vayuputras', 'AMISH', '#3b2a5a', '#f3c87a', True),
    'alchemist': ('The Alchemist', 'Paulo Coelho', '#e8833a', '#fff6e8', True),
    'secret': ('The Secret', 'Rhonda Byrne', '#5a3a22', '#e9c46a', True),
    'laws': ('The 48 Laws of Power', 'Robert Greene', '#ece4d2', '#8c1d1d', True),
    'ikigai': ('IKIGAI', 'García & Miralles', '#f2b8b0', '#2a2a2a', False),
    'courage': ('The Courage to Be Disliked', 'Kishimi & Koga', '#7fb2c9', '#ffffff', False),
    'naval': ('The Almanack of Naval Ravikant', 'Eric Jorgenson', '#1e3a5f', '#f3e9d6', False),
    'frankl': ('Man’s Search for Meaning', 'Viktor E. Frankl', '#2c2c2c', '#f2c14e', True),
    'atomic': ('Atomic Habits', 'James Clear', '#f4efe6', '#1d1d1d', False, '#e2a33b'),
    'money': ('The Psychology of Money', 'Morgan Housel', '#f3f0e8', '#1b4d3e', True),
    'now': ('The Power of Now', 'Eckhart Tolle', '#e9d6a8', '#3b2b1a', True),
}
STACKED = {'secret', 'alchemist', 'courage', 'ikigai', 'laws'}
SPINES = {k: dict(t=.048 if k in STACKED else .05 + rng.uniform(0, .008), h=.29 if k in STACKED else .29 + rng.uniform(0, .04),
                  d=.2 if k in STACKED else .19 + rng.uniform(0, .03)) for k in TITLES}


def font(name):
    path = FONTS / name
    return bpy.data.fonts.load(str(path), check_existing=True) if path.exists() else bpy.data.fonts.load('<builtin>')


def spine_atlas(ppm=2600, pad=.006):
    """Render every titled spine (title left to right, author at the far end) into one image.
    Returns the packed image and, per book, its strip's origin in atlas metres plus the atlas size."""
    fonts = {True: (font('Georgia Bold.ttf'), font('Georgia.ttf')), False: (font('Trebuchet MS Bold.ttf'), font('Trebuchet MS.ttf'))}
    width = max(s['h'] for s in SPINES.values()) + 2 * pad
    origin, y = {}, pad
    for k, s in SPINES.items(): origin[k] = (pad, y); y += s['t'] + pad
    res = (math.ceil(width * ppm), math.ceil(y * ppm)); W, H = res[0] / ppm, res[1] / ppm
    temp, inks = [], {}

    def ink(colour):
        if colour not in inks: inks[colour] = glow('Atlas ' + colour, linear(colour), 1)
        return inks[colour]

    def rect(x, y, w, h, colour, z=0.0):
        me = bpy.data.meshes.new('Atlas rect'); me.from_pydata([(x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z)], [], [(0, 1, 2, 3)])
        me.materials.append(ink(colour)); o = bpy.data.objects.new('Atlas rect', me); scene.collection.objects.link(o); temp.append(o)

    def text(body, face, size, x, y, align, colour, max_width):
        cu = bpy.data.curves.new('Atlas text', 'FONT'); cu.body = body; cu.font = face; cu.size = 1
        cu.align_x = align; cu.align_y = 'CENTER'; cu.materials.append(ink(colour))
        o = bpy.data.objects.new('Atlas text', cu); scene.collection.objects.link(o); temp.append(o)
        bpy.context.view_layer.update()
        cu.size = min(size, max_width / max(o.dimensions.x, 1e-6)); o.location = (x, y, .001)
        bpy.context.view_layer.update()
        return o.dimensions.x

    for k, (title, author, bg, fg, serif, *accent) in TITLES.items():
        x0, y0 = origin[k]; L, T = SPINES[k]['h'], SPINES[k]['t']
        rect(x0 - pad / 2, y0 - pad / 2, L + pad, T + pad, bg, -.001)  # bleed, so filtering never reaches the next strip
        for u in (.035, .957): rect(x0 + L * u, y0 + T * .12, max(.0012, L * .008), T * .76, accent[0] if accent else fg)
        bold, regular = fonts[serif]
        used = text(author, regular, T * .26, x0 + L * .93, y0 + T * .5, 'RIGHT', fg, L * .32)
        text(title, bold, T * .5, x0 + L * .07, y0 + T * .52, 'LEFT', fg, L * .86 - used - L * .05)
    cam = bpy.data.objects.new('Atlas camera', bpy.data.cameras.new('Atlas camera')); scene.collection.objects.link(cam); temp.append(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(W, H); cam.location = (W / 2, H / 2, 1); scene.camera = cam
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = False; scene.cycles.filter_width = 1.0
    scene.render.resolution_x, scene.render.resolution_y = res; scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'; scene.render.image_settings.file_format = 'PNG'
    out = Path(tempfile.mkdtemp()) / 'book-spines.png'; scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    for o in temp: bpy.data.objects.remove(o, do_unlink=True)
    img = bpy.data.images.load(str(out)); img.name = 'Book spines'; img.pack(); img.filepath = '//book-spines.png'
    return img, {k: (x / W, y / H, 1 / W, 1 / H) for k, (x, y) in origin.items()}


ATLAS, STRIPS = spine_atlas()
SPINE = node_material('Book spines · titled')[0]
_nt = SPINE.node_tree; _img = _nt.nodes.new('ShaderNodeTexImage'); _img.image = ATLAS
_nt.links.new(_img.outputs['Color'], _nt.nodes['Principled BSDF'].inputs['Base Color'])
_nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = .62

# --- scene structure ---------------------------------------------------------------------------

col = bpy.data.collections.new(NAME); scene.collection.children.link(col)
root = bpy.data.objects.new(NAME, None); col.objects.link(root)


def mesh_object(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    o = bpy.data.objects.new(name, me); col.objects.link(o); o.parent = root
    return o


def cube(bm, lo, hi, bevel=.002, mat=0):
    """Axis-aligned box from corner `lo` to `hi` with chamfered edges."""
    verts = bmesh.ops.create_cube(bm, size=1)['verts']
    bmesh.ops.scale(bm, vec=[h - l for l, h in zip(lo, hi)], verts=verts)
    bmesh.ops.translate(bm, vec=[(h + l) / 2 for l, h in zip(lo, hi)], verts=verts)
    faces = list({f for v in verts for f in v.link_faces})
    for f in faces: f.material_index = mat  # chamfer faces inherit it
    if bevel: bmesh.ops.bevel(bm, geom=list({e for f in faces for e in f.edges}), offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)


def cylinder(bm, radius, depth, matrix, segments=16):
    verts = bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth, matrix=matrix)['verts']
    for f in {f for v in verts for f in v.link_faces}: f.smooth = len(f.verts) == 4
    return verts


# --- carcass -----------------------------------------------------------------------------------

bm = bmesh.new()
for y in (Y0, Y1 - SIDE): cube(bm, (BACK, y, 0), (FRONT, y + SIDE, TOP), mat=1)                     # end panels, full depth
for y in POSTS[1:-1]: cube(bm, (INNER, y - SIDE / 2, 0), (FRONT, y + SIDE / 2, TOP - .02), mat=1)   # dividers
for i, z in enumerate(BOARDS):
    for lo, hi in BAYS:
        cube(bm, (INNER, lo, z - BOARD / 2), (FRONT - .02 if i else FRONT, hi, z + BOARD / 2))
        if 0 < i < len(BOARDS) - 1: cube(bm, (FRONT - .02, lo, z - BOARD / 2 - LIP), (FRONT, hi, z + BOARD / 2))  # edge band
for lo, hi in BAYS:
    cube(bm, (FRONT - .02, lo, BOARDS[-1] - BOARD / 2 - LIP), (FRONT, hi, TOP - .02))  # fascia carrying the rail
    cube(bm, (FRONT - .03, lo, 0), (FRONT - .01, hi, BOARDS[0] - BOARD / 2))          # kick board
cube(bm, (INNER, Y0 + SIDE, TOP - .02), (FRONT, Y1 - SIDE, TOP))                       # cap
mesh_object('Shelving · walnut', bm, [WOOD, WOOD_UP])
bm = bmesh.new(); cube(bm, (BACK, Y0 + SIDE, 0), (INNER, Y1 - SIDE, TOP), bevel=0)
mesh_object('Shelving · back panel', bm, [BACK_WOOD])

# Warm LED strips under the upper six boards, just behind the edge band; one emission-only mesh per board.
for i, z in enumerate(BOARDS[1:], 1):
    bm = bmesh.new()
    for lo, hi in BAYS: cube(bm, (FRONT - .036, lo + .015, z - BOARD / 2 - .004), (FRONT - .024, hi - .015, z - BOARD / 2), bevel=0)
    mesh_object(f'LED strip · board {i + 1}', bm, [LED])

# Brass ladder rail on stand-offs from the fascia.
bm = bmesh.new()
cylinder(bm, .012, Y1 - Y0 - .06, Matrix.Translation((RAIL_X, (Y0 + Y1) / 2, RAIL_Z)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 20)
for y in (Y0 + .03, Y1 - .03):
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=.016, matrix=Matrix.Translation((RAIL_X, y, RAIL_Z)))
for y in [Y0 + .1, *POSTS[1:-1], Y1 - .1]:
    cylinder(bm, .007, RAIL_X - FRONT, Matrix.Translation(((RAIL_X + FRONT) / 2, y, RAIL_Z)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), 12)
    cylinder(bm, .022, .006, Matrix.Translation((FRONT + .003, y, RAIL_Z)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), 20)
for f in bm.faces: f.smooth = True
mesh_object('Ladder rail · brass', bm, [BRASS])

# --- books -------------------------------------------------------------------------------------

PALETTE = ['#c2362b', '#e4572e', '#f08a4b', '#f4c95d', '#efe3c8', '#2f6b4f', '#5c8f5a', '#e98aa6', '#d9485f', '#2c4a7a',
           '#3f7cac', '#1f1f22', '#8a5a44', '#f6efe2', '#b23a48', '#7d8f69', '#a8442e', '#d8b26e', '#456b73', '#9c6b8e']
BAND_INKS = ['#efe3c8', '#c9a24a', '#1f1f22', '#f6efe2', '#8a5a44', '#b23a48']
ARC = 6  # segments across a rounded spine


def plain_book(big=False):
    hard = rng.random() < (.8 if big else .55)
    if hard:
        h = rng.uniform(.27, .35) if big else rng.uniform(.22, .31)
        t, d = rng.uniform(.026, .052), min(.23, max(.15, h * .66 + rng.uniform(-.02, .02)))
    else:
        h, t, d = rng.uniform(.2, .24), rng.uniform(.022, .04), rng.uniform(.15, .165)
    base = linear(rng.choice(PALETTE), 1)
    bands = []
    if rng.random() < .55:  # printed jacket: bands near the ends and/or a label block across the spine
        inkc = linear(rng.choice(BAND_INKS), .5)
        style = rng.random()
        if style < .4: bands = [(h * .07, h * .11, inkc), (h * .86, h * .9, inkc)]
        elif style < .7: bands = [(h * rng.uniform(.55, .62), h * rng.uniform(.74, .8), inkc)]
        else: bands = [(h * .8, h * rng.uniform(.88, .93), inkc)]
    return dict(t=t, h=h, d=d, hard=hard, colour=base, bands=bands, inset=rng.uniform(.012, .03), phi=rng.uniform(.12, .24))


def titled_book(key):
    return dict(SPINES[key], hard=True, title=key, colour=None, bands=[], inset=.014, phi=0)


def add_book(bm, M, b, colour_layer, uv_layer):
    """One book in its own frame (spine on +X, thickness along Y, standing on z = 0), placed by M.
    Hardcovers are a cover shell with a rounded spine around an inset page block; paperbacks are solid."""
    t, h, d = b['t'], b['h'], b['d']
    bulge = min(.006, t * .16) if b['hard'] else min(.0025, t * .08)
    xs, c = d / 2 - bulge, .0025
    angles = [-math.pi / 2 + math.pi * i / ARC for i in range(ARC + 1)]
    outer = [(-d / 2, -t / 2), *[(xs + bulge * math.cos(a), t / 2 * math.sin(a)) for a in angles], (-d / 2, t / 2)]
    cuts = sorted({0.0, h, *[z for z0, z1, _ in b['bands'] for z in (z0, z1)]})
    made = []
    if 'title' in b:
        u0, v0, su, sv = STRIPS[b['title']]
        swatch = (u0 + h * .015 * su, v0 + t * .5 * sv)  # plain cover colour at the strip's end

    def face(verts, mat, colour, smooth=False, spine=False):
        f = bm.faces.new(verts); f.material_index = mat; f.smooth = smooth
        for loop in f.loops:
            if colour_layer: loop[colour_layer] = (*colour, 1)
            if uv_layer:
                x, y, z = loop.vert.co
                loop[uv_layer].uv = (u0 + (h - z) * su, v0 + (y + t / 2) * sv) if spine else swatch
        return f

    def colour_at(z):
        return next((ink for z0, z1, ink in b['bands'] if z0 - 1e-6 <= z <= z1 + 1e-6), b['colour'] or (1, 1, 1))

    def ring(points, z):
        vs = [bm.verts.new((x, y, z)) for x, y in points]; made.extend(vs); return vs

    if b['hard']:
        inner = [(-d / 2, -t / 2 + c), *[(xs - c + bulge * math.cos(a), (t / 2 - c) * math.sin(a)) for a in angles], (-d / 2, t / 2 - c)]
        loop, n, no = outer + inner[::-1], 2 * len(outer), len(outer)
        rings = [ring(loop, z) for z in cuts]
        for k in range(len(cuts) - 1):
            zc = (cuts[k] + cuts[k + 1]) / 2
            for j in range(n):
                face((rings[k][j], rings[k][(j + 1) % n], rings[k + 1][(j + 1) % n], rings[k + 1][j]), 0,
                     colour_at(zc) if j < no - 1 else b['colour'] or (1, 1, 1), smooth=j < no - 1, spine=1 <= j <= ARC)
        for r, up in ((rings[-1], True), (rings[0], False)):
            for i in range(no - 1):
                q = (r[i], r[i + 1], r[n - 2 - i], r[n - 1 - i])
                face(q if up else q[::-1], 0, colour_at(h if up else 0))
        verts = bmesh.ops.create_cube(bm, size=1)['verts']; made.extend(verts)
        lo, hi = (-d / 2 + .003, -t / 2 + c + .0004, .004), (xs - c - .0005, t / 2 - c - .0004, h - .004)
        bmesh.ops.scale(bm, vec=[q - p for p, q in zip(lo, hi)], verts=verts)
        bmesh.ops.translate(bm, vec=[(p + q) / 2 for p, q in zip(lo, hi)], verts=verts)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = 1
            for l in f.loops:
                if colour_layer: l[colour_layer] = (1, 1, 1, 1)
                if uv_layer: l[uv_layer].uv = swatch
    else:
        no = len(outer); rings = [ring(outer, z) for z in cuts]
        for k in range(len(cuts) - 1):
            zc = (cuts[k] + cuts[k + 1]) / 2
            for j in range(no):
                edge = j == no - 1  # the fore-edge: pages
                face((rings[k][j], rings[k][(j + 1) % no], rings[k + 1][(j + 1) % no], rings[k + 1][j]), 1 if edge else 0,
                     colour_at(zc), smooth=not edge, spine=1 <= j <= ARC)
        face(rings[-1], 1, (1, 1, 1)); face(rings[0][::-1], 1, (1, 1, 1))
    bmesh.ops.transform(bm, matrix=M, verts=made)


T = Matrix.Translation


def Rx(a): return Matrix.Rotation(a, 4, 'X')
def Rz(a): return Matrix.Rotation(a, 4, 'Z')


def run_layout(books, y0, z, lean):
    """Upright books from y0 towards +Y. lean='start': the first book leans right onto the row; 'end': the last leans left.
    A leaning book pivots on its bottom edge nearest the row and rests on its neighbour's face or top corner."""
    gap, out, y = .0015, [], y0 - .0015
    for i, b in enumerate(books):
        x = FRONT - b['inset'] - b['d'] / 2
        if lean == 'start' and i == 0:
            phi = b['phi']; reach = min(b['h'] * math.sin(phi), books[1]['h'] * math.tan(phi)) + .0005
            q = y0 + b['t'] * math.cos(phi)
            out.append((b, T((x, q, z)) @ Rx(-phi) @ T((0, -b['t'] / 2, 0)))); y = q + reach - gap
        elif lean == 'end' and i == len(books) - 1:
            phi = b['phi']; reach = min(b['h'] * math.sin(phi), books[i - 1]['h'] * math.tan(phi)) + .0005
            q = y + reach
            out.append((b, T((x, q, z)) @ Rx(phi) @ T((0, b['t'] / 2, 0)))); y = q + b['t'] * math.cos(phi)
        else:
            out.append((b, T((x, y + gap + b['t'] / 2, z)))); y += gap + b['t']
    return out, y - y0


def stack_layout(books, yc, z):
    """Books lying flat, spines out, slightly twisted; returns placements and the height of the pile."""
    out, z0 = [], z
    for b in books:
        spin = b.setdefault('spin', rng.uniform(-.06, .06))
        x = FRONT - .012 - b['h'] / 2 * abs(math.sin(spin)) - b['d'] / 2 - rng.uniform(0, .015)
        out.append((b, T((x, yc + rng.uniform(-.008, .008), z)) @ Rz(spin) @ T((0, b['h'] / 2, b['t'] / 2)) @ Rx(math.pi / 2)))
        z += b['t'] + .0003  # resting on the one below, not coplanar with it
    return out, z - z0


# --- decor ---------------------------------------------------------------------------------------

def import_meshes(file, keep=None):
    """Import a glTF, bake each kept mesh's world transform into a copy of its data; the objects are removed."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(file))
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    meshes = []
    for o in new:
        if o.type == 'MESH' and (keep is None or keep(o.name)):
            me = o.data.copy(); me.transform(o.matrix_world); meshes.append(me)
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    return meshes


def bounds(meshes):
    co = []
    for me in meshes:
        c = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', c); co.append(c.reshape(-1, 3))
    co = np.concatenate(co)
    return Vector(co.min(0)), Vector(co.max(0))


def reduce(me, triangles):
    """Weld (glTF splits vertices along UV seams) and decimate a mesh to about `triangles` (a few passes for dense scans)."""
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(me); bm.free()
    for _ in range(4):
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        if tris <= triangles * 1.1: break
        o = bpy.data.objects.new('Decimating', me); scene.collection.objects.link(o)
        o.modifiers.new('Decimate', 'DECIMATE').ratio = triangles / tris
        graph = bpy.context.evaluated_depsgraph_get()
        out = bpy.data.meshes.new_from_object(o.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph)
        out.name = me.name
        bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me); me = out
    return me


def prop(file, keep=None, height=None, length=None, triangles=3000, spin=0.0):
    """Meshes standing on their base centre at the origin, scaled to a height (or longest side), decimated."""
    meshes = import_meshes(file, keep)
    lo, hi = bounds(meshes)
    k = height / (hi.z - lo.z) if height else length / max(hi.x - lo.x, hi.y - lo.y)
    M = Rz(spin) @ Matrix.Scale(k, 4) @ T((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    total = sum(len(p.vertices) - 2 for me in meshes for p in me.polygons)
    out = []
    for me in meshes:
        me.transform(M)
        out.append(reduce(me, max(200, int(triangles * sum(len(p.vertices) - 2 for p in me.polygons) / total))))
    return out


def painted(file, length, triangles):
    """A dense textured scan as a low-poly mesh whose colours are sampled from its texture into a colour attribute
    (per-corner colours suit a painted toy)."""
    src = prop(file, length=length, triangles=10 ** 9)[0]
    p = src.materials[0].node_tree.nodes['Principled BSDF']
    img = p.inputs['Base Color'].links[0].from_node.image; w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)[..., :3]
    px = np.where(px <= .04045, px / 12.92, ((px + .055) / 1.055) ** 2.4)  # byte image pixels are sRGB-encoded
    # Collapse decimation stalls at ~15K triangles on the scan, so rebuild it as a clean voxel shell first.
    o = bpy.data.objects.new('Remeshing', src); scene.collection.objects.link(o)
    o.modifiers.new('Remesh', 'REMESH').voxel_size = length / 120
    o.modifiers.new('Decimate', 'DECIMATE').ratio = .1
    graph = bpy.context.evaluated_depsgraph_get()
    low = reduce(bpy.data.meshes.new_from_object(o.evaluated_get(graph), depsgraph=graph), triangles)
    bpy.data.objects.remove(o, do_unlink=True)
    tree = BVHTree.FromPolygons([v.co for v in src.vertices], [p.vertices for p in src.polygons])
    uv = src.uv_layers[0].data; layer = low.color_attributes.new('Toy colour', 'FLOAT_COLOR', 'CORNER')
    for poly in low.polygons:
        for li in poly.loop_indices:
            co = low.vertices[low.loops[li].vertex_index].co * .8 + poly.center * .2  # nudged into this face
            hit = src.polygons[tree.find_nearest(co)[2]]
            u, v = sum((uv[i].uv for i in hit.loop_indices), Vector((0, 0))) / hit.loop_total
            layer.data[li].color = (*px[int(v % 1 * (h - 1)), int(u % 1 * (w - 1))], 1)
    paint = flat('Toy car paint', (1, 1, 1), rough=.35)
    attr = paint.node_tree.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'Toy colour'
    paint.node_tree.links.new(attr.outputs['Color'], paint.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    low.materials.clear(); low.materials.append(paint); low.name = 'Toy car'
    bpy.data.meshes.remove(src)
    return [low]


def fern_in_pot():
    pot = prop(PH / 'planter_pot_clay/planter_pot_clay_1k.gltf', height=.12, triangles=900)
    fern = prop(PH / 'fern_02/fern_02_1k.gltf', keep=lambda n: n.endswith('_a'), length=.3, triangles=700)
    for me in fern: me.transform(T((0, 0, .085)))  # the fronds' base sits in the pot's soil line
    return pot + fern


DECOR = {  # name: (factory, label); each factory runs once and placements share its meshes
    'vase': (lambda: prop(PH / 'ceramic_vase_01/ceramic_vase_01_1k.gltf', height=.22, triangles=1500), 'Vase · ceramic'),
    'tall vase': (lambda: prop(PH / 'ceramic_vase_03/ceramic_vase_03_1k.gltf', height=.26, triangles=1500), 'Vase · tall ceramic'),
    'succulent': (lambda: prop(PH / 'potted_plant_04/potted_plant_04_1k.gltf', height=.24, triangles=1800), 'Plant · potted succulent'),
    'fern': (fern_in_pot, 'Plant · fern in clay pot'),
    'camera': (lambda: prop(PH / 'Camera_01/Camera_01_1k.gltf', keep=lambda n: n == 'Camera_01', length=.15, triangles=2200), 'Camera · vintage'),
    'car': (lambda: painted(ROOT / 'source/meshy/toy-car.glb', length=.17, triangles=3000), 'Toy car'),
    'encyclopedia': (lambda: prop(PH / 'book_encyclopedia_set_01/book_encyclopedia_set_01_1k.gltf',
                                  keep=lambda n: n[-2:] in ('01', '02', '03', '04', '05', '06', '07'), height=.25, triangles=2500,
                                  spin=math.pi / 2), 'Books · encyclopedia set'),
}
_made = {}
LAMP_BODY = [flat('Lamp ceramic · mustard', linear('#d9a441'), rough=.35), flat('Lamp ceramic · rose', linear('#e98aa6'), rough=.35),
             flat('Lamp ceramic · cream', linear('#efe6d6'), rough=.35)]
LAMP_GLOW = glow('Shelf lamp glow', (1, .5, .2), 2.5)


def lamp_meshes(i):
    """Mushroom lamp: ceramic foot and stem (static) and an opal dome that glows (emission only, its own mesh)."""
    bm = bmesh.new()
    cylinder(bm, .048, .014, T((0, 0, .007)), 28)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=.013, radius2=.009, depth=.13, matrix=T((0, 0, .014 + .065)))
    for f in bm.faces: f.smooth = True
    body = bpy.data.meshes.new('Mushroom lamp body'); bm.to_mesh(body); bm.free(); body.materials.append(LAMP_BODY[i % 3])
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=.075)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    bmesh.ops.holes_fill(bm, edges=bm.edges)
    bmesh.ops.scale(bm, vec=(1, 1, .8), verts=bm.verts); bmesh.ops.translate(bm, vec=(0, 0, .135), verts=bm.verts)
    for f in bm.faces: f.smooth = len(f.verts) < 5
    shade = bpy.data.meshes.new('Mushroom lamp shade'); bm.to_mesh(shade); bm.free(); shade.materials.append(LAMP_GLOW)
    return [body, shade]


def decor_meshes(kind):
    if kind == 'lamp': _made['lamps'] = _made.get('lamps', 0) + 1; return lamp_meshes(_made['lamps'] - 1), 'Mushroom lamp'
    if kind not in _made: _made[kind] = DECOR[kind][0]()
    return _made[kind], DECOR[kind][1]


def footprint(meshes, turn):
    lo, hi = bounds(meshes)
    corners = [Rz(turn) @ Vector((x, y, 0)) for x in (lo.x, hi.x) for y in (lo.y, hi.y)]
    return max(c.x for c in corners) - min(c.x for c in corners), max(c.y for c in corners) - min(c.y for c in corners), hi.z


def place_decor(meshes, label, loc, turn):
    holder = bpy.data.objects.new(label, None); col.objects.link(holder); holder.parent = root
    holder.location = loc; holder.rotation_euler.z = turn
    for me in meshes:
        o = bpy.data.objects.new(label + (' · glow' if me.materials[0] == LAMP_GLOW else ' · part'), me)
        col.objects.link(o); o.parent = holder
    return holder


# --- the plan ------------------------------------------------------------------------------------
# Per shelf (bottom to top), per bay (left to right as seen from the room, i.e. towards +Y):
#   ('up', n | [titles], extra)  upright row; ('stack', n | [titles], top decor)  books lying flat; ('decor', kind)
# The story camera looks at bays 2 and 3 around eye height, so the titled books live there.
PLAN = [
    [[('up', 11), ('stack', 4, None)], [('decor', 'encyclopedia'), ('up', 9)], [('up', 9), ('decor', 'vase'), ('up', 5)],
     [('stack', 3, 'succulent'), ('up', 9)]],
    [[('up', 9), ('decor', 'lamp'), ('stack', 2, None)], [('decor', 'car'), ('stack', 2, None), ('up', 8)],
     [('up', 6), ('decor', 'camera'), ('up', 6)], [('stack', 4, None), ('up', 8)]],
    [[('decor', 'tall vase'), ('up', 10)], [('stack', ['secret', 'alchemist'], None), ('up', 9), ('decor', 'fern')],
     [('up', ['meluha', 'nagas', 'vayu'], 6), ('decor', 'lamp')], [('up', 9), ('stack', 3, None)]],
    [[('up', 9), ('decor', 'vase')], [('up', ['atomic', 'money', 'now'], 6), ('decor', 'tall vase')],
     [('stack', ['courage', 'ikigai', 'laws'], 'lamp'), ('up', ['naval', 'frankl'], 5)], [('up', 8), ('decor', 'succulent')]],
    [[('decor', 'vase'), ('up', 8)], [('up', 8), ('decor', 'fern')], [('stack', 3, None), ('up', 7)], [('up', 6), ('stack', 2, None)]],
    [[('up', 7), ('stack', 2, None)], [('decor', 'fern'), ('up', 7)], [('up', 8)], [('stack', 3, None), ('up', 6)]],
]
DEPTH_MID = (INNER + FRONT) / 2
FORWARD = {'fern': .07, 'lamp': .05, 'camera': .06, 'car': .07, 'encyclopedia': .045}  # how far in front of mid-depth

counts = dict(books=0, titled=0, decor=0)
for level, bays in enumerate(PLAN):
    floor = BOARDS[level] + BOARD / 2
    clear = BOARDS[level + 1] - BOARD / 2 - LIP - floor - .01 if level + 1 < len(BOARDS) else 1
    books = bmesh.new(); colours = books.loops.layers.float_color.new('Book colour')
    titled = bmesh.new(); uvs = titled.loops.layers.uv.new('UVMap')
    for (lo, hi), items in zip(BAYS, bays):
        built = []
        for i, item in enumerate(items):
            if item[0] == 'up':
                ids, extra = (item[1], item[2]) if isinstance(item[1], list) else ([], item[1])
                before = extra // 2
                row = [plain_book(level == 0) for _ in range(before)] + [titled_book(k) for k in ids] + \
                      [plain_book(level == 0) for _ in range(extra - before)]
                ends = ['end'] if i == 0 else ['start'] if i == len(items) - 1 else ['start', 'end']
                lean = rng.choice(ends) if rng.random() < .5 and len(row) > 3 else None
                if lean == 'start' and 'title' in row[0] or lean == 'end' and 'title' in row[-1]: lean = None
                width = run_layout(row, 0, floor, lean)[1]
                built.append(['up', width, row, lean])
            elif item[0] == 'stack':
                pile = [titled_book(k) for k in item[1]] if isinstance(item[1], list) else \
                    sorted([dict(plain_book(level == 0), hard=True) for _ in range(item[1])], key=lambda b: -b['h'] * b['d'])
                top = decor_meshes(item[2]) if item[2] else None
                width = max(b['h'] for b in pile) + .02
                if top: width = max(width, footprint(top[0], 0)[1] + .01)
                built.append(['stack', width, pile, top])
            else:
                meshes, label = decor_meshes(item[1]); turn = 0 if item[1] == 'encyclopedia' else rng.uniform(-.5, .5)
                dx, dy, dz = footprint(meshes, turn)
                assert dz < clear, (item, dz, clear)
                built.append(['decor', dy + .012, (meshes, label, turn, item[1]), None])
        free = hi - lo - sum(b[1] for b in built)
        assert free > .04, (level, items, free)
        weights = [0 if built[0][0] == 'up' else rng.uniform(.4, 1)] + [rng.uniform(.6, 1.4) for _ in built[1:]] + \
                  [0 if built[-1][0] == 'up' else rng.uniform(.4, 1)]
        if not sum(weights): weights[-1] = 1  # a lone row stands against the left divider
        y = lo + (.001 if weights[0] == 0 else 0)
        free -= .002
        for i, (kind, width, payload, extra) in enumerate(built):
            y += free * weights[i] / sum(weights)
            if kind == 'up':
                for b, M in run_layout(payload, y, floor, extra)[0]:
                    add_book(titled if 'title' in b else books, M, b, None if 'title' in b else colours, uvs if 'title' in b else None)
                    counts['titled' if 'title' in b else 'books'] += 1
            elif kind == 'stack':
                placed, height = stack_layout(payload, y + width / 2, floor)
                for b, M in placed:
                    add_book(titled if 'title' in b else books, M, b, None if 'title' in b else colours, uvs if 'title' in b else None)
                    counts['titled' if 'title' in b else 'books'] += 1
                if extra:
                    (meshes, label), turn = extra, rng.uniform(-.6, .6)
                    assert height + footprint(meshes, turn)[2] < clear, (level, items)
                    place_decor(meshes, label, (FRONT - .03 - max(b['d'] for b in payload) / 2, y + width / 2, floor + height), turn)
                    counts['decor'] += 1
            else:
                meshes, label, turn, name = payload
                place_decor(meshes, label, (DEPTH_MID + FORWARD.get(name, 0), y + width / 2, floor), turn)
                counts['decor'] += 1
            y += width
    mesh_object(f'Books · shelf {level + 1}', books, [CLOTH, PAGES])
    if titled.faces: mesh_object(f'Books · titled · shelf {level + 1}', titled, [SPINE, PAGES])
    else: titled.free()

for o in col.objects:
    o.matrix_parent_inverse = Matrix.Identity(4)
bpy.context.view_layer.update()
tris = sum(len(p.vertices) - 2 for o in col.objects if o.type == 'MESH' for p in o.data.polygons)
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backup
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'bookshelf-library.blend'))
print('BOOKSHELF_COMPLETE', len(col.objects), 'objects,', tris, 'triangles,', counts, flush=True)
