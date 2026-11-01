"""Preview renders of furniture-library.blend under neutral studio light.

blender --background blender/furniture-library.blend --python-exit-code 1 --python blender/render_furniture.py -- OUT_DIR
Writes overview.png plus close-ups of the desk, cabinet and shelving.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

out = Path(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else Path(bpy.data.filepath).parent / 'generated'
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.refresh_devices()
for d in prefs.devices: d.use = d.type == 'METAL'
scene.cycles.device = 'GPU'; scene.cycles.samples = 96; scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'

world = bpy.data.worlds.new('Studio'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.55, .53, .5, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .25

# Floor so contact shadows read, and a big soft key + fill.
bpy.ops.mesh.primitive_plane_add(size=60, location=(8, 0, 0))
floor = bpy.context.object; mat = bpy.data.materials.new('Studio floor'); mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.62, .6, .57, 1)
mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .8
floor.data.materials.append(mat)


def light(name, loc, aim, energy, size, colour=(1, .96, .9)):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.size = size; data.color = colour
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


light('Key', (4, -7, 7), (8, 0, .6), 2200, 10)
light('Fill', (14, -6, 3), (8, 0, .8), 600, 8, (.9, .95, 1))
light('Rim', (8, 6, 5), (8, 0, .8), 700, 10)

cam_data = bpy.data.cameras.new('Preview'); cam = bpy.data.objects.new('Preview', cam_data)
scene.collection.objects.link(cam); scene.camera = cam


def shot(name, loc, aim, lens, res):
    cam.location = loc; cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens; scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = str(out / f'{name}.png'); bpy.ops.render.render(write_still=True)
    print('RENDERED', name, flush=True)


out.mkdir(parents=True, exist_ok=True)
shot('overview', (8.3, -16, 4.2), (8.3, 0, .9), 40, (2400, 900))
shot('desk', (-2.2, -3.4, 2.0), (0, 0, .5), 45, (1400, 1000))
shot('cabinets', (4.6, -4.2, 1.6), (4.5, 0, .35), 40, (1400, 1000))
shot('shelves-lamps', (9.5, -5.0, 1.7), (9.6, 0, 1.2), 40, (1400, 1000))
shot('rug', (13.0, -2.6, 1.3), (13.0, 0, 0), 40, (1400, 1000))
shot('art', (16.0, -3.2, .9), (16.0, 0, .75), 45, (1400, 1000))
