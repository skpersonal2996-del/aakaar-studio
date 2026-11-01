"""The studio cat for the web: Meshy's Puszek (CC0, MrDavKot) with its quadruped walk, cut down to a web budget.

blender --background --factory-startup --python-exit-code 1 --python blender/prepare_cat.py -- [TRIANGLES] [TEXTURE_PX]
Reads blender/source/cat/puszek-walk.glb (Meshy export, 'All Animations', single file) and writes
public/studio/cat.glb: the skinned mesh decimated before the armature (so its weights survive), the
texture resized, and the walk renamed 'Walk'. The website walks it around the room (src/scene/Cat.jsx).
"""
import bpy, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TRIANGLES = int(args[0]) if args else 14000
TEXTURE_PX = int(args[1]) if len(args) > 1 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'source/cat/puszek-walk.glb'))
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
total = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
for o in meshes:
    bpy.context.view_layer.objects.active = o
    dec = o.modifiers.new('Decimate', 'DECIMATE'); dec.ratio = min(1.0, TRIANGLES / total)
    bpy.ops.object.modifier_move_to_index(modifier=dec.name, index=0)  # decimate the rest shape, not the posed one
    bpy.ops.object.modifier_apply(modifier=dec.name)
for img in bpy.data.images:
    if img.size[0] > TEXTURE_PX: img.scale(TEXTURE_PX, TEXTURE_PX)
for action in bpy.data.actions: action.name = 'Walk'
after = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
out = ROOT.parent / 'public/studio/cat.glb'
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', export_image_format='WEBP', export_image_quality=85,
                          export_animations=True, export_skins=True)
print('CAT', total, '->', after, 'triangles,', len(bpy.data.actions), 'action(s) ->', out, flush=True)
