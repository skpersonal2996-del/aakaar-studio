"""Repack Meshy's tightly packed atlas and bake padded maps, without sculpting.

Run after animate_character.py. The original GLB, mesh positions, skin weights,
and animation remain untouched. Recomputed smooth normals remove remesh facets.
"""
import bpy, sys, json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}-typing.blend'))
scene=bpy.context.scene
mesh=next(o for o in scene.objects if o.type=='MESH' and len(o.data.vertices)>10000)
arm=next(o for o in scene.objects if o.type=='ARMATURE')
scene.frame_set(1)
before=np.array([v.co[:] for v in mesh.data.vertices])
data=mesh.data
print('NORMALS_BEFORE',data.has_custom_normals,flush=True)
data.normals_split_custom_set([(0,0,0)]*len(data.loops))
for polygon in data.polygons:polygon.use_smooth=True
data.update()

source_uv=data.uv_layers.active
source_uv.name='Meshy original UV'
source_uv_name=source_uv.name
target_uv=data.uv_layers.new(name='Padded web UV',do_init=True)
target_uv_name=target_uv.name
data.uv_layers.active_index=len(data.uv_layers)-1
target_uv.active_render=True
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True);bpy.context.view_layer.objects.active=mesh
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
# Preserve the existing islands and their relative density, adding a real gutter.
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True,rotate_method='ANY',scale=True,
 margin_method='FRACTION',margin=.0025,shape_method='CONCAVE')
bpy.ops.object.mode_set(mode='OBJECT')
print('UV_REPACKED',len(data.uv_layers),flush=True)

material=data.materials[0].copy();data.materials[0]=material
nodes=material.node_tree.nodes;links=material.node_tree.links
bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
uv_node=nodes.new('ShaderNodeUVMap');uv_node.uv_map=source_uv_name
for node in list(nodes):
 if node.type=='TEX_IMAGE':
  links.new(uv_node.outputs['UV'],node.inputs['Vector'])
  # The old sheet has no gutters; closest sampling avoids borrowing another
  # island's colour while transferring it into the new padded sheet.
  node.interpolation='Closest'
 if node.type=='NORMAL_MAP':node.uv_map=source_uv_name

outdir=ROOT/'generated'/'surfaces'/name;outdir.mkdir(parents=True,exist_ok=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.render.bake.use_selected_to_active=False
scene.render.bake.margin=12
scene.render.bake.margin_type='EXTEND'
scene.render.bake.use_clear=True
emission=nodes.new('ShaderNodeEmission')
target=nodes.new('ShaderNodeTexImage')
maps={}
def image(label,colourspace):
 im=bpy.data.images.new(name+' · padded '+label,width=4096,height=4096,alpha=False)
 im.colorspace_settings.name=colourspace
 target.image=im;nodes.active=target
 return im
def save(im,label):
 im.filepath_raw=str(outdir/f'{label}.png');im.file_format='PNG';im.save();im.pack()
 maps[label]=im
 print('BAKED',name,label,flush=True)
def emit_socket(socket):
 if socket.is_linked:links.new(socket.links[0].from_socket,emission.inputs['Color'])
 else:emission.inputs['Color'].default_value=socket.default_value
 links.new(emission.outputs[0],output.inputs['Surface'])

im=image('basecolor','sRGB');emit_socket(bsdf.inputs['Base Color'])
bpy.ops.object.bake(type='EMIT');save(im,'basecolor')

# Tangent normals must be rebaked when the UV islands rotate.
links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
im=image('normal','Non-Color')
bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT');save(im,'normal')

# glTF packs roughness in G and metallic in B. Bake both through one RGB shader.
combine=nodes.new('ShaderNodeCombineColor');combine.mode='RGB'
combine.inputs['Red'].default_value=1
for label,channel in [('Roughness','Green'),('Metallic','Blue')]:
 socket=bsdf.inputs[label]
 if socket.is_linked:links.new(socket.links[0].from_socket,combine.inputs[channel])
 else:combine.inputs[channel].default_value=socket.default_value
links.new(combine.outputs[0],emission.inputs['Color'])
links.new(emission.outputs[0],output.inputs['Surface'])
im=image('metallic-roughness','Non-Color');bpy.ops.object.bake(type='EMIT');save(im,'metallic-roughness')

nodes.clear()
output=nodes.new('ShaderNodeOutputMaterial');p=nodes.new('ShaderNodeBsdfPrincipled')
links.new(p.outputs[0],output.inputs['Surface'])
for label in maps:
 node=nodes.new('ShaderNodeTexImage');node.image=maps[label];node.interpolation='Linear'
 if label=='basecolor':links.new(node.outputs['Color'],p.inputs['Base Color'])
 elif label=='normal':
  normal=nodes.new('ShaderNodeNormalMap');normal.uv_map=target_uv_name
  links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
 else:
  split=nodes.new('ShaderNodeSeparateColor');split.mode='RGB'
  links.new(node.outputs['Color'],split.inputs['Color'])
  links.new(split.outputs['Green'],p.inputs['Roughness']);links.new(split.outputs['Blue'],p.inputs['Metallic'])
data.uv_layers.remove(data.uv_layers[source_uv_name])
assert np.array_equal(before,np.array([v.co[:] for v in data.vertices])), 'Surface repair moved vertices'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}-surface.blend'))
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/'generated'/f'{name}-surface.glb'),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_skins=True,
 export_morph=False,export_yup=True,export_anim_slide_to_zero=True)
(outdir/'checks.json').write_text(json.dumps({'vertices_unchanged':True,'triangles':len(data.polygons),'atlas':4096,'padding_px':12,'uv_margin':.0025},indent=2))
print('SURFACE_REPAIR_COMPLETE',name,flush=True)
