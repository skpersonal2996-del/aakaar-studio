"""Transfer an unchanged padded surface onto a revised skeletal animation."""
import bpy,sys,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}-typing.blend'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>10000)
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
with bpy.data.libraries.load(str(ROOT/f'{name}-surface.blend'),link=False) as (source,target):target.meshes=list(source.meshes)
polished=max((m for m in target.meshes if m),key=lambda m:len(m.vertices))
assert np.array_equal(np.array([v.co[:] for v in mesh.data.vertices]),np.array([v.co[:] for v in polished.vertices])), 'Geometry changed; rebake the surface instead'
mesh.data=polished
bpy.context.scene.frame_set(1)
updated=ROOT/f'{name}-surface-updated.blend'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(updated))
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'generated'/f'{name}-surface.glb'),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_skins=True,
 export_morph=False,export_yup=True,export_anim_slide_to_zero=True)
updated.replace(ROOT/f'{name}-surface.blend')
print('SURFACE_POSE_REFRESH_COMPLETE',name,flush=True)
