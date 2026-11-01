"""Evening look-dev for the spacious room (studio-spacious-assembled.blend), in three moods.

MOOD 'dark' is the first site: charcoal plaster, linen curtains lit from the floor, pools of warm light from
the ceiling tracks. MOOD 'cream' is the cozy board's warm cream plaster with brighter coves and fill. MOOD
'warm' sits between them: deep taupe plaster, soft coves, brighter curtains, the dark room's depth.
Exec it with MOOD in its globals (render_spacious.py, bake_cozy_room.py); it defaults to 'dark'.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')
MOOD = globals().get('MOOD', 'dark')
# walls (plaster tint), right wall shade, ceiling, overall light level, cove and curtain strength, fill, world, exposure
MOODS = {
    'dark': dict(wall=(.055, .047, .042), right=.8, ceiling=(.012, .011, .01), bright=1.0, coves=0, curtains=1.0,
                 fill=220, world=.2, exposure=1.0),
    'warm': dict(wall=(.13, .095, .075), right=.8, ceiling=(.022, .017, .013), bright=1.2, coves=.45, curtains=1.25,
                 fill=300, world=.28, exposure=1.0),
    'cream': dict(wall=(.95, .74, .58), right=.7, ceiling=(.05, .036, .027), bright=1.6, coves=1.0, curtains=1.0,
                  fill=380, world=.4, exposure=.8),
}
LOOK = MOODS[MOOD]
scene = bpy.context.scene
O, M = bpy.data.objects, bpy.data.materials
TEX = ROOT / 'source/polyhaven/textures'


def centre(o):
    return sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8


def kelvin(k):
    """Approximate linear RGB for a black-body colour temperature."""
    t = k / 100
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * math.log(t) - 161.12 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * math.log(t - 10) - 305.04)
    return tuple(((min(max(c, 0), 255) / 255) ** 2.2) for c in (r, g, b))


def pbr(name, asset, metres, tint, rough=1.0, sheen=0.0):
    """Poly Haven texture set, box-projected in object space (the room's planes have no useful UVs)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    mapping = nt.nodes.new('ShaderNodeMapping'); mapping.inputs['Scale'].default_value = (1 / metres,) * 3
    nt.links.new(nt.nodes.new('ShaderNodeTexCoord').outputs['Object'], mapping.inputs['Vector'])

    def image(file, colour):
        n = nt.nodes.new('ShaderNodeTexImage'); n.projection = 'BOX'; n.projection_blend = .2
        n.image = bpy.data.images.load(str(TEX / asset / f'{file}.jpg'), check_existing=True)
        n.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
        nt.links.new(mapping.outputs['Vector'], n.inputs['Vector']); return n
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1; mix.inputs['B'].default_value = (*tint, 1)
    nt.links.new(image('diff', True).outputs['Color'], mix.inputs['A']); nt.links.new(mix.outputs['Result'], p.inputs['Base Color'])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = rough
    nt.links.new(image('rough', False).outputs['Color'], k.inputs[0]); nt.links.new(k.outputs[0], p.inputs['Roughness'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(image('nor_gl', False).outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs[0], p.inputs['Normal'])
    if sheen: p.inputs['Sheen Weight'].default_value = sheen
    return m


def surface(names, material):
    for n in names:
        if n in O: O[n].data.materials.clear(); O[n].data.materials.append(material)


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
    'Material_143': 8, 'Material_82': 10, 'Material_522': 8, 'Material_524': 8,  # globe and table lamps
    'Material_526': 3, 'Material_546': 2,                           # ID wall frame, cabinet
    'Material_224': 1.2, 'Material_232': 1.2, 'Material_262': 1,    # laptop screens, phone
    'Material_629': .45, 'Material_630': .45, 'Material_631': .45,  # city view (the website draws its own)
}
for name, s in glow_strength.items():
    if name in M: emit_all_rays(M[name], s)

# --- the city outside: the painted skyline the website shows live (CityWindow.jsx), in place of the old canvas ---
city_mats = {'Material_629', 'Material_630', 'Material_631'}
for o in O:
    if o.type == 'MESH' and any(s.material and s.material.name in city_mats for s in o.material_slots): o.hide_render = True
sky = bpy.data.materials.new('City view · painted'); sky.use_nodes = True; nt = sky.node_tree; nt.nodes.clear()
img = nt.nodes.new('ShaderNodeTexImage')
img.image = bpy.data.images.load(str(ROOT.parent / 'public/studio/window-dusk.webp'), check_existing=True)
em = nt.nodes.new('ShaderNodeEmission'); em.name = 'Emission'; em.inputs['Strength'].default_value = .9
nt.links.new(img.outputs['Color'], em.inputs['Color'])
nt.links.new(em.outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])
bpy.ops.mesh.primitive_plane_add(size=1, location=(5.975, 2.0, 2.05), rotation=(math.pi / 2, 0, -math.pi / 2))
view = bpy.context.object; view.name = 'City view'; view.scale = (2.5, 1.9, 1); view.data.materials.append(sky)

# --- surfaces: plaster walls in the mood's colour, linen curtains, near-black ceiling ---
wall = LOOK['wall']
surface(['Wall · back', 'Wall · left'], pbr('Plaster · walls', 'grey_plaster', 3.0, wall, rough=1.2))
surface(['Wall · right'], pbr('Plaster · right wall', 'grey_plaster', 3.0, tuple(c * LOOK['right'] for c in wall), rough=1.2))
linen = pbr('Linen · curtains', 'rough_linen', .5, (1.25, 1.0, .78), rough=1.1, sheen=.6)
for n in ('Curtain · back', 'Curtain · left'):
    for o in O[n].children_recursive if n in O else []:
        if o.type == 'MESH' and max(o.dimensions) > 1:  # the fabric, not the rod
            o.data.materials.clear(); o.data.materials.append(linen)
ceiling = M['Material_4'].node_tree.nodes['Principled BSDF']
ceiling.inputs['Base Color'].default_value = (*LOOK['ceiling'], 1)

# --- lights ---
col = bpy.data.collections.get('03 · Evening lighting') or bpy.data.collections.new('03 · Evening lighting')
if col.name not in scene.collection.children: scene.collection.children.link(col)
for o in list(col.objects): bpy.data.objects.remove(o, do_unlink=True)
BRIGHT = LOOK['bright']


def light(name, kind, loc, energy, k=2700, size=.1, aim=None, spot=None):
    data = bpy.data.lights.new(name, kind); data.energy = energy * BRIGHT; data.color = kelvin(k)
    if kind == 'AREA': data.shape = 'RECTANGLE' if isinstance(size, tuple) else 'DISK'; data.size, data.size_y = (size if isinstance(size, tuple) else (size, size))
    else: data.shadow_soft_size = size
    if spot: data.spot_size, data.spot_blend = spot
    ob = bpy.data.objects.new(name, data); col.objects.link(ob); ob.location = loc
    if aim: ob.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


for i, d in enumerate(o for o in O if o.name.startswith('Diffuser')):  # the desk pendants
    c = centre(d)
    light(f'Pendant bulb {i + 1}', 'SPOT', c + Vector((0, 0, .05)), 85, 2600, .05, aim=c - Vector((0, 0, 1)), spot=(math.radians(110), .6))
# Ceiling track spots, as on the first site: the back tracks wash the feature wall, the sofa and the art;
# the front track lights the bookshelf, the desk and the floor towards the window.
for x, y, aim in ((.9, 2.4, (.9, 4.95, 2.4)), (2.6, 2.4, (2.6, 4.95, 2.4)), (4.85, 2.4, (4.85, 4.95, 2.2)),
                  (-4.6, 3.4, (-4.6, 4.3, .6)), (-2.65, 3.4, (-2.65, 4.97, 2.25)), (-1.0, 3.4, (-1.0, 4.8, 1.4)),
                  (-4.3, -2.4, (-5.8, -1.0, 1.4)), (.2, -2.4, (.2, -.9, .77)), (3.8, -2.4, (4.6, -.5, 0))):
    light(f'Track spot {x:+.2f} {y:+.1f}', 'SPOT', (x, y, 4.08), 70, 3000, .03, aim=aim, spot=(math.radians(38), .5))
# Linen curtains lit from the floor, glowing warm behind the sofa.
light('Curtain uplight · back', 'AREA', (-4.78, 4.7, .06), 1100 * LOOK['curtains'], 2200, (2.3, .12), aim=(-4.78, 4.9, 3.0))
light('Curtain uplight · left', 'AREA', (-5.7, 3.5, .06), 1100 * LOOK['curtains'], 2200, (.12, 2.6), aim=(-5.9, 3.5, 3.0))
light('Sign wash', 'AREA', (1.9, 4.1, 3.95), 120, 2300, (3.0, .3), aim=(1.9, 4.9, 2.6))
light('Slat cove grazing', 'AREA', (1.9, 4.86, 4.12), 110, 2200, (3.4, .06), aim=(1.9, 4.95, 0))
light('Bookshelf wash', 'AREA', (-5.0, -1.85, 3.4), 120, 2600, (.25, 5.2), aim=(-5.98, -1.85, 1.4))
light('Open shelf wash', 'AREA', (-.95, 4.3, 2.6), 25, 2500, (.8, .25), aim=(-.95, 4.8, 0))
for name in ('Bulb', 'Mesh_143', 'Mesh_498'):  # arc lamp, shelf globe, ID cabinet lamp
    if name in O: light(f'Lamp · {name}', 'POINT', centre(O[name]) + Vector((0, 0, .03)), 30, 2400, .08)
for strip in [o for o in O if o.name.startswith('LED strip')]:  # under the open shelf's boards
    light(f'{strip.name} · light', 'AREA', centre(strip) - Vector((0, 0, .01)), 14, 2400, (.8, .03), aim=centre(strip) - Vector((0, .1, 1)))
light('Sunset through window', 'AREA', (7.2, 2.0, 2.3), 700, 2000, (2.4, 1.8), aim=(2.0, .5, 0))
light('Bounce fill · open front', 'AREA', (.3, -7.5, 2.8), LOOK['fill'], 3200, (7, 3), aim=(.3, 0, 1.2))
if LOOK['coves']:  # plaster glowing towards the ceiling, as on the board
    k = LOOK['coves']
    light('Back wall cove', 'AREA', (0, 4.85, 4.1), 520 * k, 2500, (11.5, .08), aim=(0, 4.98, 0))
    light('Left wall cove', 'AREA', (-5.85, 0, 4.1), 380 * k, 2500, (.08, 9.5), aim=(-5.98, 0, 0))
    light('Right wall cove', 'AREA', (5.85, 0, 4.1), 300 * k, 2500, (.08, 9.5), aim=(5.98, 0, 0))

# --- candles: pillar clusters on the credenza, the cabinet, the coffee table, the desk and the floor ---
dressing = bpy.data.collections.get('04 · Set dressing') or bpy.data.collections.new('04 · Set dressing')
if dressing.name not in scene.collection.children: scene.collection.children.link(dressing)
for o in [o for o in dressing.objects if o.name.startswith('Candle')]: bpy.data.objects.remove(o, do_unlink=True)
wax = M.get('Candle wax') or M.new('Candle wax'); wax.use_nodes = True
p = wax.node_tree.nodes['Principled BSDF']
p.inputs['Base Color'].default_value = (.9, .82, .7, 1); p.inputs['Roughness'].default_value = .45
p.inputs['Subsurface Weight'].default_value = .4
flame = M.get('Candle flame') or M.new('Candle flame'); flame.use_nodes = True; nt = flame.node_tree; nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.name = 'Emission'
em.inputs['Color'].default_value = (*kelvin(1700), 1); em.inputs['Strength'].default_value = 12
nt.links.new(em.outputs[0], nt.nodes.new('ShaderNodeOutputMaterial').inputs['Surface'])


def surface_z(x, y, z=1.9):
    hit, loc, *_ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), Vector((x, y, z)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0


CANDLES = [  # cluster centre (x, y), then (radius, height) per candle
    ((1.15, 4.6), [(.035, .16), (.03, .1), (.028, .07)]),  # credenza
    ((4.35, 4.65), [(.035, .14), (.03, .09)]),  # ID cabinet
    ((-3.95, 3.0), [(.04, .12), (.032, .08), (.03, .05)]),  # lounge coffee table
    ((.25, -.75), [(.03, .09), (.026, .06)]),  # desk
    ((5.55, .9), [(.07, .45), (.06, .3), (.055, .2), (.05, .14)]),  # floor under the window
    ((-5.35, 1.4), [(.07, .4), (.06, .26), (.05, .16)]),  # floor by the bookshelf
]
n = 0
for (cx, cy), sizes in CANDLES:
    z0 = surface_z(cx, cy)
    for i, (r, h) in enumerate(sizes):
        a, d = i * 2.4, (0 if i == 0 else sizes[0][0] + r + .015)
        x, y = cx + d * math.cos(a), cy + d * math.sin(a)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=h, location=(x, y, z0 + h / 2))
        body = bpy.context.object; body.name = f'Candle {n}'; body.data.materials.append(wax)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=(x, y, z0 + h + .022))
        tip = bpy.context.object; tip.name = f'Candle {n} · flame'; tip.scale = (.009, .009, .022); tip.data.materials.append(flame)
        for o in (body, tip):
            for c in o.users_collection: c.objects.unlink(o)
            dressing.objects.link(o)
        light(f'Candle {n}', 'POINT', (x, y, z0 + h + .03), 2.5, 1800, .01)
        n += 1

world = scene.world; bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (.03, .022, .016, 1); bg.inputs[1].default_value = LOOK['world']

# --- hero camera: the first site's home view, from beyond the open front ---
cam = O.get('Hero · spacious') or bpy.data.objects.new('Hero · spacious', bpy.data.cameras.new('Hero · spacious'))
if cam.name not in scene.collection.objects: scene.collection.objects.link(cam)
cam.location = (.3, -6.0, 1.8)
cam.rotation_euler = (Vector((.3, -2.8, 1.6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24
cam.data.lens = 24 / (2 * math.tan(math.radians(42) / 2))  # the web camera's fov
cam.data.dof.use_dof = False
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
scene.view_settings.exposure = LOOK['exposure']

# --- night ('rouge'): a late-night studio lit red: red wall coves, curtains, slat wall and shelf LEDs, with the lamps,
# pendants and candles still amber and the sign pink; only the moonlight through the window stays cool ---
NIGHT = [  # light name prefix: (energy factor, night colour)
    ('Sunset through window', .4, (.5, .6, 1)), ('Bounce fill', .9, (1, .8, .72)),
    ('Sign wash', 1.1, (1, .3, .5)), ('Slat cove', 1.0, (1, .18, .2)),
    ('Track spot', .7, (1, .78, .62)), ('Pendant bulb', .8, (1, .62, .42)), ('Lamp ·', .8, (1, .58, .38)),
    ('Curtain uplight', 1.0, (1, .14, .12)), ('Back wall cove', 1.0, (1, .12, .1)), ('Left wall cove', 1.0, (1, .12, .1)),
    ('Right wall cove', 1.0, (1, .12, .1)), ('Bookshelf wash', .9, (1, .2, .16)), ('Open shelf wash', .9, (1, .2, .16)),
    ('LED strip', 1.0, (1, .12, .12)), ('Candle', 2.0, (1, .45, .18)),
]
NIGHT_GLOW = (1, .22, .18)  # lamps, LEDs and pendant diffusers glow red
KEEP_GLOW = {'Material_525', 'Material_224', 'Material_232', 'Material_262', 'City view · painted', 'Candle flame'}  # sign, screens, view, flames


def night():
    # Night is as dim and moody as the dark room whatever the walls: the lights drop to its levels, the wall
    # coves fade to a faint line and the open front's fill to the dark room's.
    calm = MOODS['dark']['bright'] / LOOK['bright']
    for o in col.objects:
        factor, colour = next(((f, c) for prefix, f, c in NIGHT if o.name.startswith(prefix)), (.75, (1, .66, .52)))
        if o.name.endswith('wall cove'): factor *= .25
        if o.name.startswith('Bounce fill'): factor *= MOODS['dark']['fill'] / LOOK['fill']
        o.data.energy *= factor * calm; o.data.color = colour
    for m in bpy.data.materials:
        em = m.node_tree and m.node_tree.nodes.get('Emission')
        if not em or m.name in KEEP_GLOW or m.node_tree.nodes.get('Principled BSDF') or em.inputs['Color'].is_linked: continue
        c = em.inputs['Color'].default_value; lum = max(c[0], c[1], c[2])
        em.inputs['Color'].default_value = (*(lum * k for k in NIGHT_GLOW), 1)
    bg.inputs[0].default_value = (.03, .022, .024, 1); bg.inputs[1].default_value = MOODS['dark']['world']
