"""Spacious room pass: the original web room at its full size (12 m × 10 m × 4.2 m), as on the first site.

Starts from studio-portfolio.blend (the web room exported to glTF, plus the old editable characters) and saves
studio-spacious.blend with the same names build_cozy_room.py gives the pieces, so assemble_cozy_room.py can
replace them. Nothing moves: the lounge, bookshelf, window and ID wall stay where the first site had them.
Blender coordinates: x right, y into the room, z up. Three (x,y,z) = Blender (x,-z,y).

Run: blender --background --python-exit-code 1 --python blender/build_spacious_room.py
"""
import bpy
from pathlib import Path

try: ROOT = Path(__file__).resolve().parent
except NameError: ROOT = Path('/Users/vinay/code/studio-portfolio/blender')

bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'studio-portfolio.blend'))
O = bpy.data.objects


def tree(o):
    out = [o]
    for c in o.children: out += tree(c)
    return out


def unparent(o):
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw


room = bpy.data.collections['01 · Original spacious room']
names = {
    'Node_222': 'Lounge', 'Node_382': 'Workspace', 'Node_556': 'Bookshelf', 'Node_614': 'Credenza',
    'Node_617': 'Sign', 'Node_682': 'ID wall', 'Node_829': 'City window', 'Node_723': 'Plant · banana',
    'Node_764': 'Plant · fiddle', 'Node_805': 'Plant · lounge', 'Node_817': 'Plant · trailing',
    'Node_28': 'Slat wall', 'Node_37': 'Art print', 'Node_40': 'Poster', 'Mesh_169': 'Rug · desk',
    'Mesh_50': 'Rug · lounge', 'Node_221': 'Open shelf', 'Node_381': 'Pendants',
    'Node_31': 'Curtain · back', 'Node_34': 'Curtain · left',
    'Node_54': 'Ceiling track · right', 'Node_68': 'Ceiling track · left', 'Node_82': 'Ceiling track · front',
}
for old, new in names.items(): O[old].name = new
shell = {'Mesh_0': 'Floor', 'Mesh_1': 'Wall · back', 'Mesh_2': 'Wall · left', 'Mesh_3': 'Wall · right',
         'Mesh_4': 'Ceiling', 'Mesh_5': 'Skirting · back', 'Mesh_6': 'Skirting · left', 'Mesh_7': 'Skirting · right'}
for old, new in shell.items(): O[old].name = new
for o in list(O['Node_83'].children): unparent(o)
for n in ['Plant · banana', 'Plant · fiddle', 'Plant · lounge', 'Plant · trailing']: unparent(O[n])

# Hotspots are React, the old characters are replaced by the Meshy ones, and the room is relit in Blender.
for n in ['Node_839', 'Node_849', 'Node_859', 'Node_869', 'Node_879', 'Node_889', 'Node_83']:
    for o in reversed(tree(O[n])): bpy.data.objects.remove(o, do_unlink=True)
for o in list(room.objects):
    if o.type == 'LIGHT': bpy.data.objects.remove(o, do_unlink=True)
for c in [c for c in bpy.data.collections if 'editable typing' in c.name or 'lighting' in c.name]:
    for o in list(c.all_objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(c)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'studio-spacious.blend'))
print('SPACIOUS_LAYOUT_COMPLETE', flush=True)
