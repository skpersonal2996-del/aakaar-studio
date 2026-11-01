"""Bake the cozy room for the web: a merged room mesh plus its texture atlases.

Run on the seated room, studio-adult.blend (place_characters.py), with Blender 5.2 and a Metal GPU, then
`npm run assets:room`:
blender --background blender/studio-adult.blend --python-exit-code 1 --python blender/bake_cozy_room.py -- [lightmap_size] [samples]
The spacious room bakes the same way with its look-dev and mood (studio-spacious-adult.blend):
  ... -- 4096 256 lookdev_spacious.py dark|cream
Characters, office chairs and laptops stay live on the website (each character pair sits in its own
spot), so they only cast shadows into the bake.

Outputs in blender/generated/room-bake/ (all lighting on one shared 'Bake' UV set):
  room.glb             'Room · baked' (one merged mesh, albedo atlas on the Bake UV), 'Textured · props'
                       (photos, text, CC0 props and leaves keeping their own textures on uv0, Bake on uv1),
                       'Glossy · desk top' (walnut grain on uv0, Bake on uv1; reflective on the website)
                       and glow meshes ('Glow · …') with HDR emission colours in their material extras
  room-albedo.png      diffuse colour atlas for the merged room (noise free, 4096)
  room-light-{warm,night}.png  denoised diffuse direct+indirect lighting, sRGB-encoded after scaling
The website multiplies them: MeshBasicMaterial({ map, lightMap, lightMapIntensity: π·scale }).
"""
import bpy, bmesh, json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LIGHT_SIZE = int(args[0]) if args else 4096
SAMPLES = int(args[1]) if len(args) > 1 else 256
ALBEDO_SIZE = 4096
MAX_FACES = 12000  # decimate heavy CC0 props for the web

LOOKDEV = args[2] if len(args) > 2 else 'lookdev_cozy.py'
MOOD = args[3] if len(args) > 3 else 'dark'
LOOK = {'__file__': str(ROOT / LOOKDEV), 'MOOD': MOOD}
# Packaged for the web by `npm run assets:room [-- spacious-<mood>]`; the cozy room keeps its own folder.
OUT = ROOT / ('generated/room-bake' if LOOKDEV == 'lookdev_cozy.py' else f'generated/room-bake-spacious-{MOOD}')
exec((ROOT / LOOKDEV).read_text(), LOOK)
scene = bpy.context.scene
O = bpy.data.objects
REACT_OWNED = {'Mesh_499', 'Mesh_603', 'Mesh_604', 'Mesh_605'}  # sign glow and city view stay live in React


def emits(o):
    return any(s.material and s.material.node_tree and s.material.node_tree.nodes.get('Emission')
               and not s.material.node_tree.nodes.get('Principled BSDF') for s in o.material_slots)


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


LIVE = {d for o in O if o.name.startswith(('Office chair', 'Laptop ·')) for d in tree(o)}
rooms = [c for c in ('01 · Original spacious room', '04 · Set dressing', '06 · Assembled') if c in bpy.data.collections]
sources = [o for c in rooms for o in bpy.data.collections[c].all_objects
           if o.type in ('MESH', 'CURVE') and not o.hide_render and o.name not in REACT_OWNED and o not in LIVE]
def cutout(o):
    return any(s.material and s.material.node_tree and (p := s.material.node_tree.nodes.get('Principled BSDF'))
               and p.inputs['Alpha'].is_linked for s in o.material_slots)


def base_image(m):
    """The image driving a material's base colour, if it is a one-off picture rather than a tiling surface."""
    p = m and m.node_tree and m.node_tree.nodes.get('Principled BSDF')
    if not p or not p.inputs['Base Color'].is_linked: return None
    n = p.inputs['Base Color'].links[0].from_node
    while n.bl_idname != 'ShaderNodeTexImage':
        linked = [i for i in n.inputs if i.is_linked]
        if not linked: return None
        n = linked[0].links[0].from_node
    v = n.inputs['Vector']
    if v.is_linked and v.links[0].from_node.bl_idname == 'ShaderNodeMapping':
        if any(abs(k - 1) > 1e-3 for k in v.links[0].from_node.inputs['Scale'].default_value[:2]): return None
    return n.image


def detailed(o):
    # Photos, text, book covers and the CC0/Meshy props would blur in the shared atlas.
    return any(base_image(s.material) for s in o.material_slots)


glows = [o for o in sources if emits(o)]
textured = [o for o in sources if o not in glows and (cutout(o) or detailed(o))]
static = [o for o in sources if o not in glows and o not in textured]


def glossy(o):
    # The lacquered desk top is lit like the room but kept as its own mesh: the website draws its walnut grain
    # at full resolution and adds reflections, which the shared albedo atlas cannot.
    return any(s.material and s.material.name.startswith('Glossy walnut') for s in o.material_slots)

bake_col = bpy.data.collections.new('05 · Web bake'); scene.collection.children.link(bake_col)


def world_copy(o, name, two_sided=False):
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == 'MESH' else 0
    temp, original = [], o.data
    if tris > MAX_FACES:
        # Meshy and glTF meshes are split along their UV seams. Decimating them as they are pulls the seams
        # apart into hairline holes (the dark scratches on the sofa), so weld a copy first.
        welded = original.copy(); bm = bmesh.new(); bm.from_mesh(welded)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(welded); bm.free()
        o.data = welded
        dec = o.modifiers.new('Web decimate', 'DECIMATE'); dec.ratio = MAX_FACES / tris; temp.append(dec)
    if two_sided:
        # Leaves are single planes: a back face lets each side bake its own light.
        solid = o.modifiers.new('Web back face', 'SOLIDIFY'); solid.thickness = .002; temp.append(solid)
    graph = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph)
    for m in temp: o.modifiers.remove(m)
    if o.data is not original: welded = o.data; o.data = original; bpy.data.meshes.remove(welded)
    me.transform(o.matrix_world)
    copy = O.new(name, me); bake_col.objects.link(copy)
    return copy


def join(objs, name):
    objs = [o for o in objs if len(o.data.polygons)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: assert bpy.ops.object.join() == {'FINISHED'}
    objs[0].name = objs[0].data.name = name
    return objs[0]


def weight(src):
    """Relative lightmap detail: big flat surfaces show light pools, foliage hides its lighting."""
    names = []
    while src: names.append(src.name); src = src.parent
    text = ' '.join(names).lower()
    if any(k in text for k in ('plant', 'calathea', 'succulent', 'leaves')): return .3
    if any(k in text for k in ('floor', 'wall · ', 'rug')): return 1.6
    if any(k in text for k in ('lounge', 'sofa', 'cushion')): return 1.5  # soft cushions need smooth gradients
    if 'ceiling' in text: return .6
    return 1.0


print('BAKE copying', len(static), 'static,', len(textured), 'textured and', len(glows), 'glow objects', flush=True)
parts = [world_copy(o, o.name, weight(o) < 1) for o in static]
glow_copies = [world_copy(o, 'Glow · ' + o.name) for o in glows]
detail_copies = [world_copy(o, 'Textured · ' + o.name, weight(o) < 1) for o in textured]
for o in sources: o.hide_render = True  # the copies replace them
for o in glows: o.hide_render = False   # emitters still light the bake

# One shared 'Bake' UV atlas across the room and the leaves; the first UV map keeps driving the
# original textures while baking. Blender's packer cannot place ~100K islands at once, so each part
# is unwrapped on its own and the parts' rectangles are shelf-packed at one texel density.
import bmesh
import numpy as np

GUTTER = 3                # texels between islands in the lightmap
EXPECTED_PX_PER_M = 95    # roughly what the shelf packer reaches at 4096 (it was 103 with tighter islands)
charts = []
for o, src in zip(parts + detail_copies, static + textured):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    # Welded corners keep flat faces (e.g. the desk top's two triangles) in one island, with no seam.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-9], context='FACES')
    bm.to_mesh(me); bm.free()
    if not me.polygons: continue
    while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[-1])
    if me.uv_layers: me.uv_layers[0].name = 'UVMap'  # join matches UV maps by name
    me.uv_layers.active = me.uv_layers.new(name='Bake')
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    # A wide angle limit keeps curved cushions and rounded edges in few, large islands (fewer seams).
    # Islands need a few texels of gutter in the final atlas, or mipmaps blend a neighbour's light into
    # their edges (the dark scratches on the sofa): unwrap once to learn the part's size, then again
    # with a margin of GUTTER texels at the expected density.
    margin = .003
    for attempt in range(2):
        bpy.ops.uv.smart_project(angle_limit=math.radians(85), island_margin=margin, area_weight=1, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        # Scale each part so its UV area matches its surface area (uniform texel density).
        me.calc_loop_triangles()
        uv = np.empty(len(me.uv_layers['Bake'].data) * 2, dtype=np.float32); me.uv_layers['Bake'].data.foreach_get('uv', uv)
        uv = uv.reshape(-1, 2); tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
        me.loop_triangles.foreach_get('loops', tri); t = uv[tri.reshape(-1, 3)]
        uv_area = np.abs(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])).sum() / 2
        density = math.sqrt(sum(p.area for p in me.polygons) / max(uv_area, 1e-12)) * weight(src)
        want = min(GUTTER / (density * EXPECTED_PX_PER_M * LIGHT_SIZE / 4096), .04)
        if attempt or want <= margin * 1.2: break
        margin = want
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    lo = uv.min(0)
    charts.append(((uv.max(0) - lo) * density, uv - lo, density, o))
charts.sort(key=lambda c: -c[0][1])
PAD = 6 / LIGHT_SIZE   # gap between parts, in atlas units
SMALLEST = 10 / LIGHT_SIZE


def shelf(k, place=False):
    """Pack the parts' rectangles in rows of decreasing height; returns the extent used."""
    x = y = row = widest = 0.0
    for size, uv, density, o in charts:
        w, h = max(size[0] * k, SMALLEST) + PAD, max(size[1] * k, SMALLEST) + PAD
        if x + w > 1: x, y, row = 0.0, y + row, 0.0
        if place: o.data.uv_layers['Bake'].data.foreach_set('uv', (uv * density * k + (x + PAD / 2, y + PAD / 2)).ravel())
        x += w; row = max(row, h); widest = max(widest, x)
    return max(y + row, widest)


lo, hi = 0.0, 1.0
while shelf(hi) < 1: hi *= 2
for _ in range(30):
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if shelf(mid) <= 1 else (lo, mid)
shelf(lo, place=True)
print('BAKE packed', len(charts), 'parts at', round(lo * LIGHT_SIZE, 1), 'lightmap px/m', flush=True)

desk_copies = [p for p, src in zip(parts, static) if glossy(src)]
room = join([p for p in parts if p not in desk_copies], 'Room · baked')
desk = join(desk_copies, 'Glossy · desk top')
props = join(detail_copies, 'Textured · props')
lit = [room, desk, props]
for o in lit: o.data.uv_layers[0].active_render = True
me = room.data
print('BAKE uv done', len(me.polygons), 'faces', flush=True)


def target(name, size, float_buffer):
    img = bpy.data.images.get(name) or bpy.data.images.new(name, size, size, float_buffer=float_buffer, alpha=False)
    if tuple(img.size) != (size, size): img.scale(size, size)
    for slot in [s for o in lit for s in o.material_slots]:
        nt = slot.material.node_tree
        node = nt.nodes.get('Web bake target') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'Web bake target'; node.image = img; nt.nodes.active = node
    return img


scene.render.bake.use_selected_to_active = False
scene.render.bake.margin = 12; scene.render.bake.margin_type = 'EXTEND'
scene.render.bake.target = 'IMAGE_TEXTURES'
bpy.ops.object.select_all(action='DESELECT')
for o in lit: o.select_set(True)
bpy.context.view_layer.objects.active = room
OUT.mkdir(parents=True, exist_ok=True)

# Albedo: colour only, needs a single sample.
albedo = target('Room albedo', ALBEDO_SIZE, False)
scene.cycles.samples = 1
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, uv_layer='Bake')
albedo.filepath_raw = str(OUT / 'room-albedo.png'); albedo.file_format = 'PNG'; albedo.save()
print('BAKE albedo saved', flush=True)

# Lighting: direct + indirect diffuse, denoised (Cycles does not denoise bakes), then stored in
# 8-bit sRGB after scaling; the brightest 2 % (hot spots right under lamps) clip.
import subprocess
scales = {}


def bake_light(theme):
    light = target('Room light · ' + theme, LIGHT_SIZE, True)
    scene.cycles.samples = SAMPLES
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='Bake')
    raw, clean = OUT / f'room-light-{theme}-raw.exr', OUT / f'room-light-{theme}-denoised.exr'
    light.filepath_raw = str(raw); light.file_format = 'OPEN_EXR'; light.save()
    subprocess.run([bpy.app.binary_path, '--background', '--factory-startup', '--python-exit-code', '1',
                    '--python', str(ROOT / 'denoise_lightmap.py'), '--', str(raw), str(clean)], check=True)
    img = bpy.data.images.load(str(clean))
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    lum = px[:, :3].max(1)
    scale = float(np.percentile(lum[lum > 0], 98)) or 1.0
    lin = np.clip(px[:, :3] / scale, 0, 1)
    # Byte images store their pixels as-is, so encode sRGB here (the website decodes it as sRGB).
    px[:, :3] = np.where(lin <= .0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - .055); px[:, 3] = 1
    ldr = bpy.data.images.new(f'Room light · {theme} · ldr', LIGHT_SIZE, LIGHT_SIZE, alpha=False)
    ldr.pixels[:] = px.ravel(); ldr.filepath_raw = str(OUT / f'room-light-{theme}.png'); ldr.file_format = 'PNG'; ldr.save()
    scales[theme] = scale
    print('BAKE light', theme, 'saved scale', scale, flush=True)


bake_light('warm')
LOOK['night']()
bake_light('night')
scale = scales['warm']

# Export: the merged room keeps only the Bake UV; glows keep their emission colours.
while len(me.uv_layers) > 1: me.uv_layers.remove(me.uv_layers[0])
web = bpy.data.materials.new('Room · baked'); web.use_nodes = True
web['web_light_scale'] = scales['warm']; web['web_light_scale_night'] = scales['night']
me.materials.clear(); me.materials.append(web)
for g in glow_copies:
    for s in g.material_slots:
        nt = s.material.node_tree; em = nt.nodes.get('Emission')
        c = em.inputs['Color'].default_value; k = em.inputs['Strength'].default_value
        s.material['web_emissive'] = [c[0] * k, c[1] * k, c[2] * k]
        tex = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage' and n.name != 'Web bake target'), None)
        if tex and em.inputs['Color'].is_linked:
            # Screens: export the UI image as the emissive texture so the website can show it.
            s.material['web_emissive'] = [k, k, k]
            p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = (0, 0, 0, 1)
            nt.links.new(tex.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 1
            nt.links.new(p.outputs[0], next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeOutputMaterial').inputs[0])
# Glossy desk top: the walnut grain on a planar 'Grain' UV (uv0, tiled as in Blender) and the light on 'Bake' (uv1).
dm = desk.data; wood = dm.materials[0].node_tree.nodes
grain = next(n.image for n in wood if n.bl_idname == 'ShaderNodeTexImage' and 'diff' in n.image.filepath)
tile = wood['Mapping'].inputs['Scale'].default_value[0]
tint = list(next(n for n in wood if n.bl_idname == 'ShaderNodeMix').inputs['B'].default_value)[:3]
bake_uv = np.empty(len(dm.loops) * 2, np.float32); dm.uv_layers['Bake'].data.foreach_get('uv', bake_uv)
while dm.uv_layers: dm.uv_layers.remove(dm.uv_layers[0])
xy = np.array([dm.vertices[l.vertex_index].co[:2] for l in dm.loops], np.float32) * tile
dm.uv_layers.new(name='Grain').data.foreach_set('uv', xy.ravel())
dm.uv_layers.new(name='Bake').data.foreach_set('uv', bake_uv)
gloss = bpy.data.materials.new('Desk · glossy walnut'); gloss.use_nodes = True; nt = gloss.node_tree
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = grain
uv_node = nt.nodes.new('ShaderNodeUVMap'); uv_node.uv_map = 'Grain'; nt.links.new(uv_node.outputs[0], tex.inputs['Vector'])
nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
gloss['web_gloss'] = True; gloss['web_tint'] = tint
gloss['web_light_scale'] = scales['warm']; gloss['web_light_scale_night'] = scales['night']
dm.materials.clear(); dm.materials.append(gloss)
# Textured parts: the website only needs each picture (and its alpha cut-out) on uv0.
pictures = {}
for s in props.material_slots:
    nt = s.material.node_tree; p = nt.nodes['Principled BSDF']
    img = base_image(s.material) or next((n.image for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage'
                                          and n.name != 'Web bake target'), None)
    colour = tuple(p.inputs['Base Color'].default_value)
    key = (img.name if img else colour, cutout_material := p.inputs['Alpha'].is_linked)
    if key not in pictures:
        pic = bpy.data.materials.new((img.name if img else s.material.name) + ' · web'); pic.use_nodes = True
        nt = pic.node_tree; shader = nt.nodes['Principled BSDF']
        if img:
            node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
            nt.links.new(node.outputs['Color'], shader.inputs['Base Color'])
            if cutout_material:
                nt.links.new(node.outputs['Alpha'], shader.inputs['Alpha']); pic['web_cutout'] = True
        else:
            shader.inputs['Base Color'].default_value = colour  # plain parts of a textured prop
        pic['web_light_scale'] = scales['warm']; pic['web_light_scale_night'] = scales['night']
        pictures[key] = pic
    s.material = pictures[key]
bpy.ops.object.select_all(action='DESELECT')
for o in [room, desk, props, *glow_copies]: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'room.glb'), use_selection=True, export_format='GLB',
                          export_materials='EXPORT', export_extras=True, export_texcoords=True, export_normals=False,
                          export_apply=True, export_yup=True, export_image_format='WEBP', export_image_quality=85)
(OUT / 'room-bake.json').write_text(json.dumps({'lightScale': scales, 'lightSize': LIGHT_SIZE, 'albedoSize': ALBEDO_SIZE,
                                                'samples': SAMPLES, 'faces': len(me.polygons)}, indent=2))
print('BAKE_COMPLETE', len(me.polygons), 'faces', flush=True)
