"""Inspect downloaded Mixamo skeletons; no face or material alterations."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'source'/f'{name}-rig.glb'))
for ob in bpy.context.scene.objects:
 if ob.animation_data:ob.animation_data_clear()
 if ob.type=='ARMATURE':
  print('ARMATURE',ob.name,'MATRIX',list(ob.matrix_world),flush=True)
  for b in ob.data.bones:print('BONE',b.name,'PARENT',b.parent and b.parent.name,'HEAD',list(ob.matrix_world@b.head_local),'TAIL',list(ob.matrix_world@b.tail_local),flush=True)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
print('BOUNDS',[[min(p[i] for p in pts),max(p[i] for p in pts)] for i in range(3)],flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/f'{name}-rig.blend'))
