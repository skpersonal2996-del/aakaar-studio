"""Render actual exported character geometry for reference comparisons."""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent.parent
args=sys.argv[sys.argv.index('--')+1:]
name=args[0];source=Path(args[1]);height=float(args[2]) if len(args)>2 else 1.75
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in s.objects if o.type=='MESH']
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
low=Vector(tuple(min(v[i] for v in points) for i in range(3)));high=Vector(tuple(max(v[i] for v in points) for i in range(3)))
print('SOURCE_BOUNDS',name,list(low),list(high),flush=True)
scale=height/(high.z-low.z)
anchor=bpy.data.objects.new(name+' · normalized source',None);s.collection.objects.link(anchor)
for ob in list(s.objects):
 if ob!=anchor and ob.parent is None:ob.parent=anchor
anchor.scale=(scale,)*3
anchor.location=(-(low.x+high.x)*scale/2,-(low.y+high.y)*scale/2,-low.z*scale)
for mat in bpy.data.materials:
 if mat.use_nodes:
  p=mat.node_tree.nodes.get('Principled BSDF')
  if p:p.inputs['Specular IOR Level'].default_value=.25
world=bpy.data.worlds.new('Neutral evening studio');s.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.05,.04,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35
mat=bpy.data.materials.new('Warm grey ground');mat.diffuse_color=(.10,.08,.065,1);mat.use_nodes=True
p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(.10,.08,.065,1);p.inputs['Roughness'].default_value=.9
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));bpy.context.object.data.materials.append(mat)
def area(label,loc,target,energy,color,size):
 data=bpy.data.lights.new(label,'AREA');data.energy=energy;data.color=color;data.shape='DISK';data.size=size
 ob=bpy.data.objects.new(label,data);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('Soft warm key',(-2.8,-3.8,3.8),(0,0,1.1),400,(1,.82,.67),3)
area('Neutral fill',(3,-2.2,2.4),(0,0,1.3),180,(.88,.92,1),3)
area('Warm hair edge',(1,2.0,3.4),(0,0,1.4),340,(1,.72,.5),2)
data=bpy.data.cameras.new('Reference comparison camera');cam=bpy.data.objects.new('Reference comparison camera',data);s.collection.objects.link(cam)
s.camera=cam;data.type='ORTHO'
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=20;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.05;s.cycles.adaptive_min_samples=4;s.cycles.use_denoising=True
s.cycles.max_bounces=5;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast'
s.render.image_settings.file_format='PNG';s.render.resolution_percentage=100
out=root/'blender/generated';out.mkdir(exist_ok=True)
for view,loc,target,span,w,h in [
 ('standing',(2.5,-7,2.6),(0,0,height*.50),height*1.18,800,1100),
 ('closeup',(1.3,-3.8,2.1),(0,-.02,height*.855),height*.45,900,900),
]:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();data.ortho_scale=span
 s.render.resolution_x=w;s.render.resolution_y=h;s.render.filepath=str(out/f'{name}-{view}-v2.png')
 bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(root/'blender'/f'{name}-character.blend'))
print('CHARACTER_INSPECTION_COMPLETE',name,flush=True)
