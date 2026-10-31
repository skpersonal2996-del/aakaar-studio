"""Export the current Blender scene without flattening its editable source geometry."""
import bpy
from pathlib import Path

def export_web(scene, destination):
    export_scene=bpy.data.scenes.new('Web export')
    copies={}
    for original in scene.objects:
        if original.type in {'LIGHT','CAMERA'}:continue
        obj=original.copy()
        if obj.data:obj.data=original.data.copy()
        export_scene.collection.objects.link(obj);copies[original]=obj
    for original,obj in copies.items():
        if original.parent:obj.parent=copies.get(original.parent)
    bpy.context.window.scene=export_scene
    for obj in export_scene.objects:obj.select_set(obj.type in {'MESH','CURVE','FONT'})
    bpy.context.view_layer.objects.active=next(o for o in export_scene.objects if o.type=='MESH')
    bpy.ops.object.convert(target='MESH')
    for obj in export_scene.objects:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(destination),export_format='GLB',use_selection=True,
        export_apply=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,
        export_cameras=False,export_lights=False,export_materials='EXPORT',export_yup=True)
    bpy.context.window.scene=scene
    bpy.data.scenes.remove(export_scene)

if __name__=='__main__':
    root=Path(__file__).resolve().parent.parent
    export_web(bpy.context.scene,root/'blender/generated/studio.glb')
    print('STUDIO_EXPORT_COMPLETE',flush=True)
