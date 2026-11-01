"""Render the cozy hero view headlessly.

blender --background blender/studio-cozy.blend --python-exit-code 1 --python blender/render_cozy.py -- out.png [samples] [percent]
"""
import bpy, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = args[0] if args else str(ROOT / 'generated/cozy-hero.png')
exec((ROOT / 'lookdev_cozy.py').read_text(), {'__file__': str(ROOT / 'lookdev_cozy.py')})
scene = bpy.context.scene
scene.cycles.samples = int(args[1]) if len(args) > 1 else 128
scene.render.resolution_percentage = int(args[2]) if len(args) > 2 else 100
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('COZY_RENDER_COMPLETE', out, flush=True)
