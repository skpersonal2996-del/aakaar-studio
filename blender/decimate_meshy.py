"""Reduce a Meshy GLB to a target triangle count, keeping its UVs and textures.

blender --background --factory-startup --python-exit-code 1 --python blender/decimate_meshy.py -- IN.glb OUT.glb TRIANGLES [TEXTURE_PX]
Used before Meshy rigging (max 300K faces) and for web budgets.
"""
import bpy, sys

src, out, target = sys.argv[sys.argv.index('--') + 1:][:3]
texture_px = int(sys.argv[sys.argv.index('--') + 4]) if len(sys.argv) > sys.argv.index('--') + 4 else 2048
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
total = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
for o in meshes:
    dec = o.modifiers.new('Decimate', 'DECIMATE'); dec.ratio = min(1.0, int(target) / total)
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=dec.name)
for img in bpy.data.images:
    if img.size[0] > texture_px: img.scale(texture_px, texture_px)
after = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO')
print('DECIMATED', total, '->', after, flush=True)
