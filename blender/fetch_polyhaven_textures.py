"""Download the CC0 Poly Haven texture sets used by the Blender-built furniture and room surfaces (2K JPG maps).

python3 blender/fetch_polyhaven_textures.py
Writes blender/source/polyhaven/textures/<asset>/<map>.jpg (diff, nor_gl, rough, disp).
"""
import json, urllib.request
from pathlib import Path

TEXTURES = ['black_walnut_veneer_02', 'black_oak_veneer', 'hessian_230', 'oak_wood_planks',
            'rough_linen', 'grey_plaster', 'marble_01']  # the last three: curtains, walls, coffee table
MAPS = {'Diffuse': 'diff', 'nor_gl': 'nor_gl', 'Rough': 'rough', 'Displacement': 'disp'}
OUT = Path(__file__).resolve().parent / 'source/polyhaven/textures'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'aakaar-studio-portfolio'})
    with urllib.request.urlopen(req) as r: return r.read()


for asset in TEXTURES:
    files = json.loads(get(f'https://api.polyhaven.com/files/{asset}'))
    folder = OUT / asset; folder.mkdir(parents=True, exist_ok=True)
    for key, name in MAPS.items():
        entry = files.get(key, {}).get('2k', {}).get('jpg')
        if not entry: continue
        target = folder / f'{name}.jpg'
        if not (target.exists() and target.stat().st_size == entry['size']): target.write_bytes(get(entry['url']))
    print('fetched', asset, sorted(p.name for p in folder.iterdir()), flush=True)
(OUT / 'LICENSE.txt').write_text('All textures: CC0, Poly Haven (https://polyhaven.com). Assets: ' + ', '.join(TEXTURES) + '\n')
