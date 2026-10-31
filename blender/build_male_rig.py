"""Bind the unchanged male Meshy mesh to a Blender-adjusted Mixamo skeleton."""
import bpy,math,json,numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source/vinay-remesh.glb'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
mesh.data.transform(mesh.matrix_world);mesh.parent=None;mesh.matrix_world=Matrix.Identity(4)
p=np.array([v.co[:] for v in mesh.data.vertices]);low=p.min(axis=0);high=p.max(axis=0);scale=1.75/(high[2]-low[2])
transform=Matrix.Translation(Vector((-(high[0]+low[0])*scale/2,-(high[1]+low[1])*scale/2,-low[2]*scale)))@Matrix.Scale(scale,4)
mesh.data.transform(transform);mesh.name='Vinay · original Meshy surface'
# Welding duplicate positions retains the UV values on each face corner and
# closes texture seams for heat diffusion; it does not sculpt the surface.
import bmesh
bm=bmesh.new();bm.from_mesh(mesh.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.000005);bm.to_mesh(mesh.data);bm.free();mesh.data.update()
for poly in mesh.data.polygons:poly.use_smooth=True
before=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source/shruti-rig.glb'))
added=set(bpy.context.scene.objects)-before
arm=next(o for o in added if o.type=='ARMATURE')
for ob in list(bpy.context.scene.objects):
 if ob not in (arm,mesh):bpy.data.objects.remove(ob,do_unlink=True)
arm.animation_data_clear();arm.name='Vinay · Mixamo skeleton'
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);mesh.select_set(False)
bpy.ops.object.mode_set(mode='EDIT')
eb=arm.data.edit_bones
for b in eb:b.use_connect=False
# Body joints follow the male A-pose instead of inheriting the female arm angle.
def setbone(label,head,tail):
 b=eb['mixamorig:'+label];b.head=head;b.tail=tail
setbone('Hips',(0,0,.96),(0,0,1.035))
setbone('Spine',(0,0,1.035),(0,0,1.115))
setbone('Spine1',(0,0,1.115),(0,0,1.205))
setbone('Spine2',(0,0,1.205),(0,0,1.27))
setbone('Neck',(0,0,1.285),(0,0,1.39))
setbone('Head',(0,0,1.39),(0,.005,1.55))
setbone('HeadTop_End',(0,.005,1.74),(0,.005,1.80))
eb['headfront'].head=(0,-.12,1.40);eb['headfront'].tail=(0,-.12,1.54)
for side,sign in [('Left',1),('Right',-1)]:
 old_hand=eb['mixamorig:'+side+'Hand'];old_head=old_hand.head.copy();old_finger=eb['mixamorig:'+side+'HandMiddle3'].tail.copy()
 new_wrist=Vector((sign*.425,-.021,.870));new_end=Vector((sign*.528,-.044,.740))
 old_vec=old_finger-old_head;new_vec=new_end-new_wrist;q=old_vec.rotation_difference(new_vec);factor=new_vec.length/old_vec.length
 children=[b for b in eb if b.name.startswith('mixamorig:'+side+'Hand') or b.name==('Bone_035' if side=='Left' else 'Bone_036')]
 for b in children:
  b.head=new_wrist+q@(b.head-old_head)*factor;b.tail=new_wrist+q@(b.tail-old_head)*factor
 shoulder=Vector((sign*.175,-.008,1.235));elbow=Vector((sign*.29,-.015,1.045))
 setbone(side+'Shoulder',(sign*.04,0,1.265),shoulder)
 setbone(side+'Arm',shoulder,elbow);setbone(side+'ForeArm',elbow,new_wrist)
 setbone(side+'UpLeg',(sign*.10,.015,.88),(sign*.11,.03,.495))
 setbone(side+'Leg',(sign*.11,.03,.495),(sign*.115,.045,.145))
 setbone(side+'Foot',(sign*.115,.045,.145),(sign*.14,-.14,.035))
 setbone(side+'ToeBase',(sign*.14,-.14,.035),(sign*.16,-.19,.03))
 setbone(side+'Toe_End',(sign*.16,-.19,.03),(sign*.16,-.21,.03))
for b in eb:
 if b.name=='headfront' or b.name.startswith('Bone_') or b.name.endswith(('_End','Middle4')):b.use_deform=False
bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
# Standard Blender heat binding, with a deterministic distance fallback for any
# disconnected fragments that cannot receive diffusion weights.
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
try:bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except RuntimeError as e:print('HEAT_BIND_WARNING',str(e),flush=True)
if not any(m.type=='ARMATURE' for m in mesh.modifiers):m=mesh.modifiers.new('Mixamo deformation','ARMATURE');m.object=arm
mesh.parent=arm
unweighted=[v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups)<.001]
print('HEAT_BIND_UNWEIGHTED',len(unweighted),flush=True)
if unweighted:
 candidates=[b for b in arm.data.bones if b.use_deform]
 positions=np.array([mesh.data.vertices[i].co[:] for i in unweighted]);dist=[]
 for b in candidates:
  a=np.array(b.head_local[:]);v=np.array((b.tail_local-b.head_local)[:]);t=np.clip(((positions-a)@v)/max(v@v,1e-9),0,1)
  dist.append(np.linalg.norm(positions-(a+t[:,None]*v),axis=1))
 distances=np.array(dist).T;nearest=np.argsort(distances,axis=1)[:,:3]
 for row,index in enumerate(unweighted):
  choices=nearest[row];weights=1/np.maximum(distances[row,choices],.008)**4;weights/=weights.sum()
  for j,w in zip(choices,weights):
   group=mesh.vertex_groups.get(candidates[j].name) or mesh.vertex_groups.new(name=candidates[j].name);group.add([index],float(w),'REPLACE')
# The complete face, hair and ears are rigid under the head bone.
ids=[v.index for v in mesh.data.vertices if v.co.z>1.32]
for group in mesh.vertex_groups:group.remove(ids)
group=mesh.vertex_groups.get('mixamorig:Head') or mesh.vertex_groups.new(name='mixamorig:Head');group.add(ids,1,'REPLACE')
for pb in arm.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update();bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'vinay-rig.blend'))
print('MALE_RIG_COMPLETE',len(mesh.data.vertices),len(arm.data.bones),flush=True)
