"""Export the props that stay live on the website (they move with each character pair): chair and laptop.

blender --background blender/studio-adult.blend --python-exit-code 1 --python blender/export_live_props.py
Writes blender/generated/live/<name>.glb at room scale, base centred on the origin, front facing -Y,
reduced to about 20K triangles. `npm run assets:room` compresses them into public/studio/.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'generated/live'; OUT.mkdir(parents=True, exist_ok=True)
O = bpy.data.objects


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


for root_name, file in (('Office chair · Vinay', 'office-chair'), ('Laptop · Vinay', 'laptop')):
    root = O[root_name]
    root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    meshes = [o for o in tree(root) if o.type == 'MESH']
    total = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    for o in meshes:
        dec = o.modifiers.new('Web', 'DECIMATE'); dec.ratio = min(1.0, 20000 / total)
    bpy.ops.object.select_all(action='DESELECT')
    for o in tree(root): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f'{file}.glb'), export_format='GLB', use_selection=True,
                              export_apply=True, export_animations=False, export_image_format='WEBP', export_image_quality=88)
    print('EXPORTED', file, total, flush=True)
