"""Assemble the actual web room and editable typing characters in one project.

Export the room at localhost:5173/?authoring, copy aakaar-room.glb into
blender/generated/room-web.glb, then run this script with Blender 5.2 LTS.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
room=bpy.data.collections.new('01 · Original spacious room');scene.collection.children.link(room)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'generated/room-web.glb'))
for ob in list(scene.objects):
 for collection in list(ob.users_collection):collection.objects.unlink(ob)
 room.objects.link(ob)
 # Blender uses its own soft area lights; the exported browser light units and
 # ambient/environment rig are renderer-specific.
 if ob.type=='LIGHT':ob.hide_render=True;ob.hide_viewport=True

for name,position,angle in [('vinay',(-1.4,-1.05,0),math.pi/2),('shruti',(1.8,-.78,0),-math.pi/2)]:
 collection=bpy.data.collections.new('02 · '+name.title()+' · editable typing');scene.collection.children.link(collection)
 with bpy.data.libraries.load(str(ROOT/f'{name}-typing-source.blend'),link=False) as (source,target):target.objects=list(source.objects)
 loaded=[ob for ob in target.objects if ob]
 arm=next(ob for ob in loaded if ob.type=='ARMATURE')
 actor=next(ob for ob in loaded if ob.type=='MESH' and len(ob.data.vertices)>10000)
 controls=[ob for ob in loaded if ob.type=='EMPTY']
 keep=[arm,actor,*controls]
 for ob in keep:collection.objects.link(ob)
 # Transfer the verified padded UVs and smooth normals to the editable source.
 with bpy.data.libraries.load(str(ROOT/f'{name}-surface.blend'),link=False) as (source,target):target.meshes=list(source.meshes)
 polished=max((m for m in target.meshes if m),key=lambda m:len(m.vertices))
 assert len(polished.vertices)==len(actor.data.vertices)
 actor.data=polished
 anchor=bpy.data.objects.new(name.title()+' · room placement',None);collection.objects.link(anchor)
 for ob in keep:
  if ob.parent not in keep:ob.parent=anchor
 anchor.location=position;anchor.rotation_euler.z=angle
 actor.name=name.title()+' · restored face / padded PBR'
 for ob in loaded:
  if ob not in keep:bpy.data.objects.remove(ob,do_unlink=True)

lighting=bpy.data.collections.new('03 · Warm evening lighting');scene.collection.children.link(lighting)
world=bpy.data.worlds.new('Evening ambient');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.075,.055,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.3
def area(label,loc,target,energy,colour,size):
 data=bpy.data.lights.new(label,'AREA');data.energy=energy;data.color=colour;data.shape='DISK';data.size=size
 ob=bpy.data.objects.new(label,data);lighting.objects.link(ob);ob.location=loc
 ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
area('Broad warm window',(-3,-4,4),(.1,-1,1),650,(1,.78,.56),4)
area('Soft front fill',(2,-5,2.6),(.2,-1,1),220,(1,.88,.75),4)
area('Shared desk pendant pool',(.2,-.9,3.5),(.2,-.9,.7),180,(1,.72,.43),2.5)
area('Lounge pool',(-4,2.4,3.6),(-4,3.2,.4),180,(1,.73,.47),2)
area('Slat wall wash',(1.9,3.6,3.6),(1.9,5,1.8),150,(1,.65,.34),2)
area('Bookshelf pool',(-4.5,-.5,3.5),(-6,-1,1.5),100,(1,.68,.39),2)

data=bpy.data.cameras.new('Home · same composition as website');camera=bpy.data.objects.new('Home · same composition as website',data)
scene.collection.objects.link(camera);scene.camera=camera
camera.location=(.3,-6,1.8);target=Vector((.3,-2.8,1.6))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
data.type='PERSP';data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=24/(2*math.tan(math.radians(42)/2))
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.cycles.use_denoising=True;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.06
scene.cycles.max_bounces=6
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.fps=30;scene.frame_start=1;scene.frame_end=241;scene.frame_set(1)
scene['README']='Current original web room, editable skeletal typing controls, restored faces, padded UV maps. Browser interactions and warm/night transitions live in the React source.'
scene['web_coordinates']='Three (x,y,z) = Blender (x,-z,y)'
# Start in the scene camera, with material preview available immediately.
for screen in bpy.data.screens:
 for area_ui in screen.areas:
  if area_ui.type=='VIEW_3D':area_ui.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'studio-portfolio.blend'))
scene.render.filepath=str(ROOT/'generated/full-scene.png');bpy.ops.render.render(write_still=True)
print('FULL_SCENE_COMPLETE',len(scene.objects),flush=True)
