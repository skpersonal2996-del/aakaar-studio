"""Seat an unchanged Meshy character using skeletal controls, then bake typing.

No face sculpting, colour grading, head scaling or texture repainting. Original
source geometry and PBR images remain the asset's appearance authority.
"""
import bpy,sys,math,json
import numpy as np
import bmesh
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:];name=args[0];static='--static-only' in args
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}-rig.blend'))
s=bpy.context.scene
arm=next(o for o in s.objects if o.type=='ARMATURE')
mesh=next(o for o in s.objects if o.type=='MESH' and len(o.data.vertices)>10000)
# Meshy's importer supplies a small Icosphere used only for bone display.
for ob in list(s.objects):
 if ob not in (arm,mesh):bpy.data.objects.remove(ob,do_unlink=True)
for ob in (arm,mesh):
 if ob.animation_data:ob.animation_data_clear()
for pb in arm.pose.bones:
 pb.matrix_basis=Matrix.Identity(4)
 for con in list(pb.constraints):pb.constraints.remove(con)
 pb.rotation_mode='QUATERNION';pb.ik_stretch=0
bpy.context.view_layer.update()
# Give coincident UV-seam vertices one shared set of skin weights. UV values
# remain per face corner; no vertex is moved or face shape sculpted.
bm=bmesh.new();bm.from_mesh(mesh.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.000005);bm.to_mesh(mesh.data);bm.free();mesh.data.update()
# Put the female humerus pivots inside the dropped shoulders. Meshy's automatic
# estimate was below the shoulder cap, making the upper arm unnecessarily short.
if name=='shruti':
 bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT')
 for side,sign in [('Left',1),('Right',-1)]:
  upper=arm.data.edit_bones['mixamorig:'+side+'Arm'];upper.use_connect=False
  upper.head=Vector((sign*.15,float(upper.head.y),1.18))
  arm.data.edit_bones['mixamorig:'+side+'Shoulder'].tail=upper.head
 bpy.ops.object.mode_set(mode='OBJECT')
 bpy.context.view_layer.update()
bones=arm.pose.bones
B=lambda suffix:bones['mixamorig:'+suffix]
D=lambda suffix:arm.data.bones['mixamorig:'+suffix]
# Seated hip joints remain just above the existing 49 cm chair cushion.
hip=(D('LeftUpLeg').head_local+D('RightUpLeg').head_local)*.5
arm.location=Vector((-hip.x,-hip.y,.53-hip.z))

def rotate_world(suffix,axis,angle):
 pb=B(suffix);local_axis=pb.bone.matrix_local.to_quaternion().inverted()@Vector(axis)
 pb.rotation_quaternion=Quaternion(local_axis,angle)
for suffix in ['Spine','Spine1','Spine2']:rotate_world(suffix,(1,0,0),math.radians(2))
for side,sign in [('Left',1),('Right',-1)]:rotate_world(side+'Shoulder',(0,0,1),math.radians(-18*sign))
rotate_world('Head',(1,0,0),math.radians(2))
bpy.context.view_layer.update()
controls=bpy.data.collections.new('Pose controls · editable');s.collection.children.link(controls)
def empty(label,location,rotation=None):
 ob=bpy.data.objects.new(label,None);controls.objects.link(ob);ob.location=location;ob.empty_display_type='SPHERE';ob.empty_display_size=.025
 if rotation:ob.rotation_mode='QUATERNION';ob.rotation_quaternion=rotation
 return ob

def ik(suffix,target,pole,desired_joint):
 pb=B(suffix);con=pb.constraints.new('IK');con.name='Keyboard / seated contact';con.target=target;con.pole_target=pole;con.chain_count=2;con.use_stretch=False;con.iterations=100
 # Resolve the imported bone roll by inspecting the actual solved elbow/knee.
 best=(1e9,0)
 for i in range(36):
  angle=-math.pi+i*math.tau/36;con.pole_angle=angle;bpy.context.view_layer.update()
  joint=arm.matrix_world@pb.head;cost=(joint-Vector(desired_joint)).length_squared
  if cost<best[0]:best=(cost,angle)
 con.pole_angle=best[1];bpy.context.view_layer.update()
 print('IK_POLE',suffix,best,flush=True)
 return con

wrists={};feet={}
for side,sign in [('Left',1),('Right',-1)]:
 ankle_rest=D(side+'Foot').head_local
 target=empty(side+' ankle · planted',(sign*.115,-.35,float(ankle_rest.z)))
 pole=empty(side+' knee direction',(sign*.12,-.9,.72))
 ik(side+'Leg',target,pole,(sign*.11,-.34,.52))
 foot_target=empty(side+' foot · flat',target.location,D(side+'Foot').matrix_local.to_quaternion())
 con=B(side+'Foot').constraints.new('COPY_ROTATION');con.target=foot_target;con.owner_space='WORLD';con.target_space='WORLD'
 feet[side]=target
 # Wrist lies before the keyboard; palm and fingers reach its front rows.
 wrist=empty(side+' wrist · keyboard',(sign*.090,-.405,.802 if name=='shruti' else .805))
 elbow=empty(side+' elbow direction',(sign*.36,-.12,.68))
 ik(side+'ForeArm',wrist,elbow,(sign*.24,-.14,.79))
 hand=D(side+'Hand');f=(D(side+'HandMiddle3').tail_local-hand.head_local).normalized()
 palm=Vector((0,-1,0));palm=(palm-f*palm.dot(f)).normalized()
 src=Matrix((f.cross(palm),f,palm)).transposed()
 pitch=math.radians(5 if name=='shruti' else 6.5)
 forward=Vector((0,-math.cos(pitch),-math.sin(pitch)))
 # Both source palms face forward in the A-pose. Point that normal down onto
 # the keyboard; the prior female sign left her palms facing the ceiling.
 normal=-Vector((0,-math.sin(pitch),math.cos(pitch)))
 dest=Matrix((forward.cross(normal),forward,normal)).transposed()
 q=(dest@src.inverted()@hand.matrix_local.to_3x3()).to_quaternion()
 hand_target=empty(side+' hand · palm down',wrist.location,q)
 con=B(side+'Hand').constraints.new('COPY_ROTATION');con.target=hand_target;con.owner_space='WORLD';con.target_space='WORLD'
 wrists[side]=wrist
bpy.context.view_layer.update()
# A rigid head preserves the restored face exactly during skeletal movement.
head_index=mesh.vertex_groups.find('mixamorig:Head')
if head_index<0:mesh.vertex_groups.new(name='mixamorig:Head')
threshold=float(D('Neck').head_local.z)+.035
ids=[v.index for v in mesh.data.vertices if v.co.z>=threshold]
# The long brown hair must follow the head rigidly as well. It extends below the
# neck, so a height-only head mask would leave a visible seam across the waves.
if name=='shruti':
 material=mesh.data.materials[0]
 image=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
 w,h=image.size;pixels=np.array(image.pixels[:],dtype=np.float32).reshape((h,w,4))
 uv=np.array([d.uv[:] for d in mesh.data.uv_layers.active.data])
 colors=pixels[(np.clip(uv[:,1],0,.999999)*h).astype(int),(np.clip(uv[:,0],0,.999999)*w).astype(int),:3]
 vi=np.array([l.vertex_index for l in mesh.data.loops]);vc=np.zeros((len(mesh.data.vertices),3));counts=np.zeros(len(vc))
 np.add.at(vc,vi,colors);np.add.at(counts,vi,1);vc/=np.maximum(counts[:,None],1)
 positions=np.array([v.co[:] for v in mesh.data.vertices]);r,g,b=vc.T
 hair=(positions[:,2]>.94)&(np.max(vc,axis=1)<.72)
 ids=list(set(ids).union(np.flatnonzero(hair).tolist()))
for group in mesh.vertex_groups:group.remove(ids)
mesh.vertex_groups['mixamorig:Head'].add(ids,1,'REPLACE')
print('RIGID_HEAD_VERTICES',len(ids),flush=True)
# Smooth body skin weights over the welded surface. This removes sharp changes
# between nearby bind regions while keeping the entire head and hair fixed.
weights=np.zeros((len(mesh.data.vertices),len(mesh.vertex_groups)),dtype=np.float32)
for v in mesh.data.vertices:
 for g in v.groups:weights[v.index,g.group]=g.weight
edges=np.array([e.vertices[:] for e in mesh.data.edges]);degree=np.bincount(edges.ravel(),minlength=len(weights))
movable=np.ones(len(weights),bool);movable[ids]=False
for _ in range(8):
 sums=np.zeros_like(weights)
 np.add.at(sums,edges[:,0],weights[edges[:,1]]);np.add.at(sums,edges[:,1],weights[edges[:,0]])
 weights[movable]=weights[movable]*.6+(sums/np.maximum(degree[:,None],1))[movable]*.4
weights/=np.maximum(weights.sum(axis=1,keepdims=True),1e-9)
all_ids=list(range(len(weights)))
for group in mesh.vertex_groups:group.remove(all_ids)
for index,row in enumerate(weights):
 for group in np.flatnonzero(row>.003):mesh.vertex_groups[int(group)].add([index],float(row[group]),'REPLACE')
# Record contact errors using the evaluated skeleton, not the control targets.
checks={}
for side in ['Left','Right']:
 for suffix,target in [('ForeArm',wrists[side]),('Leg',feet[side])]:
  point=arm.matrix_world@B(side+suffix).tail;checks[side+suffix]={'actual':list(point),'target':list(target.location),'error_m':(point-target.location).length}
print('CONTACT_CHECKS',json.dumps(checks),flush=True)

# The guide furniture uses the website's actual dimensions and placements.
stage=bpy.data.collections.new('Guide furniture · not exported');s.collection.children.link(stage)
def mat(label,color,rough=.8,metal=0):
 m=bpy.data.materials.new(label);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
wood=mat('Desk guide',(.20,.085,.035));black=mat('Chair guide',(.014,.014,.015));silver=mat('Laptop guide',(.33,.35,.38),.35,.75);keymat=mat('Keyboard guide',(.018,.02,.024));ground=mat('Neutral floor',(.075,.065,.055))
def box(label,loc,size,material,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);ob=bpy.context.object;ob.name=label;ob.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for col in list(ob.users_collection):col.objects.unlink(ob)
 stage.objects.link(ob);ob.data.materials.append(material)
 if bevel:mod=ob.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3;ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return ob
box('Desk surface · 76.5 cm',(0,-1.6,.7375),(1.35,2.7,.055),wood)
box('Chair cushion',(0,.03,.45),(.50,.48,.08),black,.035)
back=box('Chair back',(0,.28,.86),(.46,.06,.60),black,.03);back.rotation_euler.x=math.radians(7)
box('Chair stem',(0,0,.25),(.055,.055,.32),black)
for x in [-.27,.27]:box('Chair arm',(x,0,.70),(.06,.26,.03),black)
box('Laptop base',(0,-.52,.773),(.34,.235,.016),silver,.006)
screen=box('Laptop screen',(0,-.665,.895),(.34,.008,.225),silver,.004);screen.rotation_euler.x=math.radians(-18)
for row in range(4):
 for col in range(11):box('Key',( (col-5)*.024,-(.523+row*.022),.783),(.019,.017,.002),keymat,.002)
box('Trackpad',(0,-.455,.783),(.105,.06,.001),keymat,.003)
box('Floor',(0,-.3,-.025),(200,200,.04),ground,0)
world=bpy.data.worlds.new('Neutral review lighting');s.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.07,.065,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35

def area(label,loc,energy,color,size):
 data=bpy.data.lights.new(label,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(label,data);stage.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,-.2,.8))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Soft key',(-2,-3,4),350,(1,.87,.73),3);area('Neutral fill',(3,-1,2.5),160,(.88,.94,1),3);area('Hair edge',(1,2,3),300,(1,.75,.53),2)
camdata=bpy.data.cameras.new('Pose review');cam=bpy.data.objects.new('Pose review',camdata);stage.objects.link(cam);s.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=2.0
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=True;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.04;s.cycles.max_bounces=5
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.render.resolution_x=1100;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
out=ROOT/'generated';out.mkdir(exist_ok=True)
for label,loc in ([] if '--no-render' in args else [('seated',(2.7,-3.5,2.2)),('side',(3.5,-.1,1.6))]):
 cam.location=loc;cam.rotation_euler=(Vector((0,-.22,.78))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/f'{name}-{label}.png');bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}-seated.blend'))
(out/f'{name}-contact-checks.json').write_text(json.dumps(checks,indent=2))
print('SEATED_POSE_COMPLETE',name,flush=True)
