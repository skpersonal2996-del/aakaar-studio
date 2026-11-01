"""Denoise a baked lightmap with the compositor's OpenImageDenoise node (Cycles does not denoise bakes).

Called by bake_cozy_room.py in a separate factory-startup Blender, so compositing renders nothing else:
blender --background --factory-startup --python blender/denoise_lightmap.py -- in.exr out.exr
"""
import bpy, sys

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
image = bpy.data.images.load(src)
scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y = image.size
scene.render.resolution_percentage = 100
scene.render.use_compositing = True
scene.view_settings.view_transform = 'Standard'  # keep the linear values untouched
scene.render.image_settings.file_format = 'OPEN_EXR'
scene.render.image_settings.color_depth = '32'

tree = bpy.data.node_groups.new('Denoise lightmap', 'CompositorNodeTree')
scene.compositing_node_group = tree
tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
node = tree.nodes.new('CompositorNodeImage'); node.image = image
denoise = tree.nodes.new('CompositorNodeDenoise')
denoise.inputs['HDR'].default_value = True
denoise.inputs['Quality'].default_value = 'High'
tree.links.new(node.outputs['Image'], denoise.inputs['Image'])
tree.links.new(denoise.outputs['Image'], tree.nodes.new('NodeGroupOutput').inputs[0])

bpy.ops.render.render()
bpy.data.images['Render Result'].save_render(out)
print('DENOISED', out, flush=True)
