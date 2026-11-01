"""Render a seated character (from seat_meshy_character.py) at a desk: typing and mid-wave.

blender --background blender/<NAME>-seated.blend --python-exit-code 1 --python blender/render_seated_check.py -- OUT_PREFIX
"""
import bpy, sys, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = max((o for o in scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
print('VERTS', len(mesh.data.vertices), flush=True)


def box(loc, size, colour):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = size
    m = bpy.data.materials.new('m'); m.diffuse_color = (*colour, 1); m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*colour, 1); o.data.materials.append(m)


wrist_y = -.33
box((0, wrist_y - .45, .74), (1.6, 1.0, .05), (.25, .12, .06))       # desk top, its near edge in front of the wrists
box((0, wrist_y - .08, .775), (.31, .22, .02), (.6, .6, .62))           # laptop base under the hands
box((0, .02, .45), (.5, .48, .08), (.02, .02, .02))                     # chair seat
box((0, 0, -.01), (6, 6, .02), (.3, .27, .24))                          # floor
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (.5, .48, .45, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .8
sun = bpy.data.lights.new('s', 'SUN'); sun.energy = 3; so = bpy.data.objects.new('s', sun); scene.collection.objects.link(so)
so.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.render.engine = 'BLENDER_EEVEE'; scene.render.resolution_x, scene.render.resolution_y = 900, 800
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.lens = 40


def shot(name, loc, aim, action, frame):
    arm.animation_data.action = bpy.data.actions[action]
    arm.animation_data.action_slot = bpy.data.actions[action].slots[0]
    scene.frame_set(frame)
    cam.location = loc; cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{out}-{name}.png'; bpy.ops.render.render(write_still=True); print('SHOT', name, flush=True)


shot('typing-side', (2.6, -.6, 1.2), (0, -.2, .8), 'TypingIdle', 40)
shot('typing-front', (1.4, -2.6, 1.5), (0, -.2, .85), 'TypingIdle', 40)
shot('wave', (-1.6, -2.6, 1.4), (0, -.1, 1.0), 'Wave', 37)
