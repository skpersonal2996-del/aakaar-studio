"""Download the CC0 Poly Haven props used by the cozy room (1k glTF) into blender/source/polyhaven/.

python3 blender/fetch_polyhaven_props.py
"""
import json, urllib.request
from pathlib import Path

PROPS = ['potted_plant_01', 'potted_plant_02', 'potted_plant_04', 'calathea_orbifolia_01', 'pachira_aquatica_01',
         'anthurium_botany_01', 'fern_02', 'ceramic_vase_01', 'ceramic_vase_03', 'book_encyclopedia_set_01',
         'Camera_01', 'throw_pillows_01', 'stationery_supplies', 'planter_pot_clay']
OUT = Path(__file__).resolve().parent / 'source/polyhaven'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'aakaar-studio-portfolio'})
    with urllib.request.urlopen(req) as r: return r.read()


for asset in PROPS:
    files = json.loads(get(f'https://api.polyhaven.com/files/{asset}'))['gltf']['1k']['gltf']
    folder = OUT / asset
    for rel, info in {f'{asset}_1k.gltf': files, **files.get('include', {})}.items():
        target = folder / rel
        if target.exists() and target.stat().st_size == info['size']: continue
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(get(info['url']))
    print('fetched', asset, flush=True)
(OUT / 'LICENSE.txt').write_text('All assets: CC0, Poly Haven (https://polyhaven.com). Assets: ' + ', '.join(PROPS) + '\n')
