"""Close, unobstructed checks of the real posed hand geometry and keyboard."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}-typing.blend'))
s=bpy.context.scene;s.render.resolution_x=900;s.render.resolution_y=650
s.cycles.samples=16;s.camera.data.ortho_scale=.64
for label,frame,location in [('hands-top',1,(.3,-.6,1.7)),('hands-side',42,(.75,-.65,1.15))]:
 s.frame_set(frame);s.camera.location=location
 s.camera.rotation_euler=(Vector((0,-.51,.80))-s.camera.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str(ROOT/'generated'/f'{name}-{label}.png');bpy.ops.render.render(write_still=True)
print('HANDS_REVIEW_COMPLETE',name,flush=True)
