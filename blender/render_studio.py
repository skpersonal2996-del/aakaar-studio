"""Re-render the saved Blender source without rebuilding any geometry.

Blender -b blender/aakaar-studio.blend -t 6 --python blender/render_studio.py
CPU rendering avoids first-run Metal compilation; STUDIO_RENDER_GPU=1 enables Metal.
"""
import bpy, os, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

root=Path(__file__).resolve().parent.parent
output=root/'blender/generated';output.mkdir(exist_ok=True)
scene=bpy.context.scene
scene.cycles.device='CPU'
if os.environ.get('STUDIO_RENDER_GPU'):
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    scene.cycles.device='GPU'
scene.cycles.samples=32
scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.04
scene.cycles.adaptive_min_samples=8
scene.cycles.use_denoising=True
scene.render.resolution_percentage=100
desktop=scene.camera
desktop.location=(.3,-8.5,3)
desktop.rotation_euler=(Vector((.3,.5,1.8))-desktop.location).to_track_quat('-Z','Y').to_euler()
desktop.data.lens=30
desktop.data.dof.focus_distance=(desktop.location-Vector((0,-.97,1.6))).length
mobile=bpy.data.objects.get('Studio · portrait camera')
if not mobile:
    mobile=bpy.data.objects.new('Studio · portrait camera',bpy.data.cameras.new('Studio · portrait camera'))
    scene.collection.objects.link(mobile)
mobile.location=(2.5,-11.8,4.6)
mobile.rotation_euler=(Vector((0,.2,1.8))-mobile.location).to_track_quat('-Z','Y').to_euler()
mobile.data.lens=40
markers={
    'projects':(1.2,-.88,1.95),'story':(-5.82,-.3,2.7),'services':(-1.18,-.92,1.95),
    'process':(-3.2,1.85,1.65),'about':(5.2,3.2,3.65),'contact':(-.28,-1.61,1.55),
}
layout={'desktop':{},'mobile':{}}
for name,cam,w,h in [('desktop',desktop,1920,1200),('mobile',mobile,1000,1400)]:
    scene.camera=cam;scene.render.resolution_x=w;scene.render.resolution_y=h
    for key,pos in markers.items():
        p=world_to_camera_view(scene,cam,Vector(pos));layout[name][key]=[round(p.x*100,3),round((1-p.y)*100,3)]
    if os.environ.get('STUDIO_RENDER_VIEW', name) == name:
        scene.render.filepath=str(output/f'studio-{name}.png')
        print('Rendering',name,flush=True)
        bpy.ops.render.render(write_still=True)
(root/'src/scene/studio-layout.json').write_text(json.dumps(layout,indent=2)+'\n')
scene.camera=desktop;scene.render.resolution_x=1920;scene.render.resolution_y=1200
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'blender/aakaar-studio.blend'))
print('STUDIO_RENDERS_COMPLETE',flush=True)
