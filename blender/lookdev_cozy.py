"""Warm evening look-dev for studio-cozy.blend: practical lights, warm walls, hero camera.

Run after build_cozy_room.py, in the same Blender session or on the saved file.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')
scene = bpy.context.scene
O, M = bpy.data.objects, bpy.data.materials


def centre(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


def kelvin(k):
    """Approximate linear RGB for a black-body colour temperature."""
    t = k / 100
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.04)
    return tuple(((min(max(c, 0), 255) / 255) ** 2.2) for c in (r, g, b))


# --- emitters: the web's unlit glows become real emission that lights the room ---
def emit_all_rays(mat, strength):
    """Emit for every ray type, keeping the texture's alpha cut-out (sign letters, city layers)."""
    nt = mat.node_tree
    em = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeEmission')
    out = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeOutputMaterial')
    em.inputs['Strength'].default_value = strength
    tex = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage'), None)
    if not tex:
        nt.links.new(em.outputs[0], out.inputs['Surface']); return
    cut = nt.nodes.new('ShaderNodeMixShader'); clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    nt.links.new(tex.outputs['Alpha'], cut.inputs[0])
    nt.links.new(clear.outputs[0], cut.inputs[1]); nt.links.new(em.outputs[0], cut.inputs[2])
    nt.links.new(cut.outputs[0], out.inputs['Surface'])


glow_strength = {
    'Material_10': 6,                                               # slat-wall ceiling cove
    'Material_525': 2.2,                                            # aakaar sign letters
    'Material_275': 60, 'Material_280': 60, 'Material_285': 60,     # pendant diffusers
    'Material_143': 8, 'Material_82': 10, 'Material_522': 8, 'Material_524': 8,  # globe and table lamps
    'Material_526': 3, 'Material_546': 2,                           # ID wall frame, cabinet
    **{f'Material_{i}': 14 for i in (89, 91, 93, 95, 299, 300, 301, 302, 303, 304)},  # shelf LED strips
    'Material_224': 1.2, 'Material_232': 1.2, 'Material_262': 1,    # laptop screens, phone
    'Material_629': 1.5, 'Material_630': 1.5, 'Material_631': 1.5,  # city view
}
for name, s in glow_strength.items():
    if name in M: emit_all_rays(M[name], s)

# --- warm cream plaster (approved board), darker right wall, dark warm ceiling ---
for name, colour in {'Material_1': (.56, .39, .26), 'Material_2': (.58, .40, .27),
                     'Material_3': (.30, .20, .13), 'Material_4': (.05, .036, .027)}.items():
    nt = M[name].node_tree
    mix = next((n for n in nt.nodes if n.bl_idname == 'ShaderNodeMix'), None)
    if mix: mix.inputs[7].default_value = (*colour, 1)
    else: nt.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*colour, 1)

# --- lights ---
col = bpy.data.collections.get('03 · Warm evening lighting')
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)


def light(name, kind, loc, energy, k=2700, size=.1, aim=None, spot=None, shadow_soft=None):
    data = bpy.data.lights.new(name, kind); data.energy = energy; data.color = kelvin(k)
    if kind == 'AREA': data.shape = 'RECTANGLE' if isinstance(size, tuple) else 'DISK'; data.size, data.size_y = (size if isinstance(size, tuple) else (size, size))
    else: data.shadow_soft_size = size
    if spot: data.spot_size, data.spot_blend = spot
    ob = bpy.data.objects.new(name, data); col.objects.link(ob); ob.location = loc
    if aim: ob.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


# The assembled room (assemble_cozy_room.py) has new pendants and an arc floor lamp; the plain cozy
# room still has the original web ones.
diffusers = [o for o in O if o.name.startswith('Diffuser')] or [O[n] for n in ('Mesh_275', 'Mesh_280', 'Mesh_285')]
for i, d in enumerate(diffusers):
    c = centre(d)
    light(f'Pendant bulb {i + 1}', 'SPOT', c + Vector((0, 0, .05)), 95, 2600, .05, aim=c - Vector((0, 0, 1)), spot=(math.radians(110), .6))
light('Lounge globe', 'POINT', centre(O.get('Bulb') or O['Mesh_82']), 40, 2400, .12)
light('Shelf globe', 'POINT', centre(O['Mesh_143']), 15, 2400, .08)
light('Credenza lamp', 'POINT', centre(O['Mesh_498']) + Vector((0, 0, .03)), 25, 2400, .08)
light('Sign wash', 'AREA', (2.85, 1.6, 3.5), 120, 2300, (2.8, .3), aim=(2.85, 2.6, 1.6))
light('Slat cove grazing', 'AREA', (2.85, 2.45, 3.55), 90, 2200, (2.9, .06), aim=(2.85, 2.6, 0))
light('Open shelf wash', 'AREA', (.75, 1.9, 2.6), 25, 2500, (.8, .25), aim=(.75, 2.4, 0))
light('Bookshelf wash', 'AREA', (-3.7, -3.1, 3.0), 50, 2600, (.25, 3.6), aim=(-4.3, -3.1, 0))
for strip in [o for o in O if o.name.startswith('LED strip')]:  # assemble_cozy_room.py
    light(f'{strip.name} · light', 'AREA', centre(strip) - Vector((0, 0, .01)), 14, 2400, (.8, .03), aim=centre(strip) - Vector((0, .1, 1)))
light('Sofa reading pool', 'SPOT', (-2.4, .9, 3.4), 140, 2500, .25, aim=(-2.3, .6, 0), spot=(math.radians(75), .9))
light('ID wall wash', 'AREA', (4.0, 1.0, 3.4), 40, 2900, (.3, 1.8), aim=(4.7, 1.0, 1.4))
# ceiling coves grazing the plaster, so the walls glow brighter towards the top as on the board
light('Back wall cove', 'AREA', (-2.0, 2.45, 3.5), 260, 2500, (4.4, .08), aim=(-2.0, 2.62, 0))
light('Left wall cove', 'AREA', (-4.15, -1.2, 3.5), 220, 2500, (.08, 5.5), aim=(-4.32, -1.2, 0))
light('Sunset through window', 'AREA', (6.2, -2.2, 2.4), 900, 2000, (2.6, 1.6), aim=(1.5, -1.0, 0))
light('Bounce fill · camera side', 'AREA', (-.5, -5.6, 2.6), 160, 3000, (4, 2.5), aim=(.3, -.5, .9))

world = scene.world; bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (.05, .035, .025, 1); bg.inputs[1].default_value = .35

# --- hero camera ---
cam = O.get('Hero · cozy') or bpy.data.objects.new('Hero · cozy', bpy.data.cameras.new('Hero · cozy'))
if cam.name not in scene.collection.objects: scene.collection.objects.link(cam)
cam.location = (-.75, -4.45, 1.72)  # front left and a little above, so the desk runs diagonally as on the board
focus = Vector((.35, -.85, 1.05))
aim = Vector((.1, -.45, 1.0))
cam.rotation_euler = (aim - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24
cam.data.lens = 24 / (2 * math.tan(math.radians(42) / 2))  # the web camera's fov
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (focus - cam.location).length; cam.data.dof.aperture_fstop = 2.8
scene.camera = cam

# --- render ---
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.refresh_devices()
for d in prefs.devices: d.use = d.type == 'METAL'
scene.cycles.device = 'GPU'
scene.cycles.samples = 128; scene.cycles.use_denoising = True; scene.cycles.adaptive_threshold = .03
scene.cycles.max_bounces = 8; scene.cycles.diffuse_bounces = 4
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .8

# --- soft clay edges: weld split glTF corners and bevel small hard-surface parts ---
import bmesh
room = bpy.data.collections['01 · Original spacious room']
done = set()
for o in room.all_objects:
    me = o.data if o.type == 'MESH' else None
    if not me or me.name in done or len(me.vertices) > 400 or any(m.type == 'BEVEL' for m in o.modifiers): continue
    if any(s.material and s.material.node_tree.nodes.get('Emission') for s in o.material_slots): continue
    dims = sorted(o.dimensions)
    if dims[0] < .006: continue
    done.add(me.name)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.join_triangles(bm, faces=bm.faces, angle_face_threshold=math.radians(1), angle_shape_threshold=math.radians(180))
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    bev = o.modifiers.new('Soft edge', 'BEVEL')
    bev.width = min(.008, dims[0] * .2); bev.segments = 3; bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(40); bev.harden_normals = True; bev.miter_outer = 'MITER_ARC'


# --- night: the same practicals, dimmer and cooler, with moonlight and the pink sign halo ---
NIGHT = {  # light: (energy factor, colour; None keeps the warm colour)
    'Sunset through window': (.5, (.35, .45, 1)),
    'Bounce fill · camera side': (.9, (.6, .62, 1)),
    'Sign wash': (1.1, (1, .32, .68)),
    'Slat cove grazing': (.9, (1, .38, .72)),
    'ID wall wash': (.8, (.75, .72, 1)),
}


def night():
    for o in col.objects:
        factor, colour = NIGHT.get(o.name, (.75, None))
        o.data.energy *= factor
        if colour: o.data.color = colour
    bg.inputs[0].default_value = (.015, .018, .04, 1)
