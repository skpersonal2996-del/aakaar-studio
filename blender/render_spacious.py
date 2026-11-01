"""Render the spacious room in one mood from the first site's views: home, the bookshelf side, the window side.

blender --background blender/studio-spacious-chibi.blend --python-exit-code 1 --python blender/render_spacious.py -- OUT_PREFIX dark|cream [samples] [percent]
Writes OUT_PREFIX-<mood>-<view>.png.
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:]
prefix, mood = args[0], args[1]
exec((ROOT / 'lookdev_spacious.py').read_text(), {'__file__': str(ROOT / 'lookdev_spacious.py'), 'MOOD': mood})
scene = bpy.context.scene; cam = scene.camera
scene.cycles.samples = int(args[2]) if len(args) > 2 else 96
scene.render.resolution_percentage = int(args[3]) if len(args) > 3 else 60
VIEWS = {  # Blender (x, y, z) camera → target; the web's drag range around the home view covers these
    'home': ((.3, -6.0, 1.8), (.3, -2.8, 1.6)),
    'bookshelf': ((1.2, -5.6, 2.0), (-3.6, .6, 1.4)),
    'window': ((-1.4, -5.6, 1.9), (4.2, .8, 1.5)),
}
for view, (loc, aim) in VIEWS.items():
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f'{prefix}-{mood}-{view}.png'
    bpy.ops.render.render(write_still=True)
    print('SPACIOUS_RENDER', scene.render.filepath, flush=True)
