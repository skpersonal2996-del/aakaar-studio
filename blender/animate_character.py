"""Bake a seated typing loop from editable skeletal controls; export only the actor."""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}-seated.blend'))
s=bpy.context.scene;arm=next(o for o in s.objects if o.type=='ARMATURE');mesh=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>10000)
B=lambda suffix:arm.pose.bones['mixamorig:'+suffix]
s.render.fps=30;s.frame_start=1;s.frame_end=241
base={suffix:B(suffix).rotation_quaternion.copy() for suffix in ['Spine','Spine1','Spine2','Head']}
axis={suffix:B(suffix).matrix.to_quaternion().inverted()@Vector((1,0,0)) for suffix in base}
fingers={};wrists={};ankles={}
for side in ['Left','Right']:
 wrists[side]=bpy.data.objects[side+' wrist · keyboard'];ankles[side]=bpy.data.objects[side+' ankle · planted']
 for number in [1,2,3]:
  suffix=side+'HandMiddle'+str(number)
  fingers[suffix]=(B(suffix).rotation_quaternion.copy(),B(suffix).matrix.to_quaternion().inverted()@Vector((1,0,0)))
wrist_base={side:ob.location.copy() for side,ob in wrists.items()}
for frame in range(1,242):
 t=(frame-1)/30
 for suffix in base:
  amount=.0025*math.sin(math.tau*t/4) if suffix!='Head' else .005*math.sin(math.tau*t/8)
  pb=B(suffix);pb.rotation_quaternion=base[suffix]@Quaternion(axis[suffix],amount);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=suffix)
 for side,frequency,phase in [('Left',3,.0),('Right',3.5,1.8)]:
  burst=.35+.65*(.5+.5*math.cos(math.tau*t/4))
  tap=max(0,math.sin(math.tau*frequency*t+phase))
  target=wrists[side];target.location=wrist_base[side]+Vector((0,0,.0015*tap*burst));target.keyframe_insert(data_path='location',frame=frame)
  for number,amplitude in ([(1,.045),(2,.07),(3,.025)] if name=='shruti' else [(1,.075),(2,.10),(3,.035)]):
   suffix=side+'HandMiddle'+str(number);q,a=fingers[suffix]
   pb=B(suffix);pb.rotation_quaternion=q@Quaternion(a,amplitude*tap*burst);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=suffix)
s.frame_set(1);bpy.context.view_layer.update()
# Preserve controls and their animation before baking, for editable authoring.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}-typing-source.blend'))
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.nla.bake(frame_start=1,frame_end=241,step=1,only_selected=False,visual_keying=True,clear_constraints=True,clear_parents=False,use_current_action=False,clean_curves=True,bake_types={'POSE'},channel_types={'LOCATION','ROTATION','SCALE'})
arm.animation_data.action.name='TypingIdle'
# Independent contact check after the constraints have been removed.
errors={side:{'wrist':0.,'ankle':0.} for side in ['Left','Right']}
for frame in range(1,242,8):
 s.frame_set(frame);bpy.context.view_layer.update()
 for side in ['Left','Right']:
  for bone,target,key in [(side+'ForeArm',wrists[side],'wrist'),(side+'Leg',ankles[side],'ankle')]:
   distance=((arm.matrix_world@B(bone).tail)-target.location).length;errors[side][key]=max(errors[side][key],distance)
print('BAKED_CONTACT_MAX_ERROR_M',json.dumps(errors),flush=True)
if max(v for side in errors.values() for v in side.values())>.004:raise RuntimeError('Baked contact exceeds 4 mm')
# Render a second typing moment and a rear hair view before packaging.
s.cycles.samples=20
for label,frame,loc,target in ([] if '--no-render' in sys.argv else [
 ('typing-check',42,(2.6,-3.0,2.0),(0,-.22,.78)),
 ('hair-back',121,(2.3,3,2.0),(0,.0,1.08)),
]):
 s.frame_set(frame);s.camera.location=loc;s.camera.rotation_euler=(Vector(target)-s.camera.location).to_track_quat('-Z','Y').to_euler()
 back=bpy.data.objects.get('Chair back');hidden=back.hide_render if back else False
 if label=='hair-back' and back:back.hide_render=True
 s.render.filepath=str(ROOT/'generated'/f'{name}-{label}.png');bpy.ops.render.render(write_still=True)
 if back:back.hide_render=hidden
s.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}-typing.blend'))
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
out=ROOT/'generated'/f'{name}-typing.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_skins=True,export_morph=False,export_yup=True,export_anim_slide_to_zero=True)
(ROOT/'generated'/f'{name}-animation-checks.json').write_text(json.dumps({'contact_max_error_m':errors,'frames':[1,241],'fps':30,'duration_s':8,'head_shape':'unchanged original geometry, rigid skeletal transform'},indent=2))
print('TYPING_EXPORT_COMPLETE',name,str(out),flush=True)
