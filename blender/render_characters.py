"""Render real character close-ups in the studio for checking the reference style."""
import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'blender/generated';out.mkdir(exist_ok=True)
s=bpy.context.scene;s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.frame_set(1)
for name,az in [('Vinay',.53),('Shruti',-.58)]:
    person=bpy.data.objects[name]
    target=Vector((person.location.x,person.location.y,2.08))
    pos=target+Vector((math.sin(az)*2.25,-math.cos(az)*2.25,.18))
    data=bpy.data.cameras.new(name+' close-up');cam=bpy.data.objects.new(name+' close-up',data);s.collection.objects.link(cam)
    cam.location=pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler();data.lens=75
    data.dof.use_dof=True;data.dof.focus_distance=2.25;data.dof.aperture_fstop=3.5
    s.camera=cam;s.render.filepath=str(out/(name.lower()+'-closeup.png'))
    print('Rendering character',name,flush=True)
    bpy.ops.render.render(write_still=True)
print('CHARACTER_CLOSEUPS_COMPLETE',flush=True)
