# studio-portfolio / aakaar

Aakaar's studio portfolio for Shruti and Vinay. The room is a cozy 9 × 7.7 metre studio lit and baked in Blender Cycles, with face-to-face seating, camera paths, pulsing hotspots, typing animation, warm/night switch, music, and six sections.

## Development

Node.js 22.12+ and npm. React 18, Vite 8, React Three Fiber, and custom CSS. No Tailwind or shadcn.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

The package and local project are named `studio-portfolio`, saved at `/Users/vinay/code/studio-portfolio`. The original Git remote is retained. This checkout has not been deployed.

## Source ownership

| File | Owns |
| --- | --- |
| `src/App.jsx` | Lazy 3D loading, local fonts, deep links, 3D failure boundary |
| `src/ui/Overlay.jsx` | Original entry, warm/night, music, Explore, Reset and navigation |
| `src/scene/views.js` | Room dimensions, cameras, hotspots and click targets |
| `src/scene/BakedRoom.jsx` | Baked room GLB, lightmap materials, glow meshes and click targets |
| `src/scene/CameraRig.jsx` | Original camera movements and drag limits |
| `src/scene/Lights.jsx` | Character-only lights (the room's light is baked) |
| `src/scene/Team.jsx` | Restored Meshy models, seating, baked typing loops and founder interactions |
| `src/styles.css` | Original visual design and section animations |
| `src/refinements.css` | Local font names, focus styles and responsive fixes |
| `src/ui/Panel.jsx` | Portfolio content and keyboard focus management |
| `src/content.js` | Studio copy, projects, founder photos and contact details |

## Characters and Blender authoring

Both restored Meshy characters are now seated and animated in the original room. Their faces, skin colour and hairstyles retain the original source appearance; the rejected facial deformation and AI face-edit trials are not used. The source downloads under `blender/source/` remain unchanged.

The female source export includes a Mixamo skeleton from the available Meshy rigging trial. Further auto-rigging required Pro, so the male skeleton was adapted and bound locally in Blender. Head and long-hair weights are rigid under the head bone to prevent the shoulder animation from pulling the hair apart. UV seam positions are welded without sculpting the surface, and body weights are smoothed for the seated pose.

Each actor has an eight-second looping animation with alternating finger taps, small wrist movements, breathing and a slight head drift. The feet remain planted. The baked wrist and ankle checks stay within 0.2 mm of their control targets. Reduced motion displays a seated static frame. Founder hover/click introductions and the original camera peeks remain available.

The runtime models are `public/characters/vinay-typing.glb` (about 6.81 MB) and `shruti-typing.glb` (about 7.17 MB). Packaging keeps approximately 103K triangles per actor and uses Meshopt compression, lossless 2K base-colour and normal maps, and a lossless 1K roughness/metallic map. Compression does not decimate or reshape the faces.

The original Meshy atlas placed contrasting skin, hair and clothing islands too close together. Browser mipmaps blended their edges, creating orange dotted seams even in unlit rendering. `repair_character_surface.py` preserves the vertices, repacks the UV islands with gutters, recalculates smooth normals and bakes padded 4K authoring maps before web packaging. The ear geometry remains the source geometry, with repaired shading. The female palm orientation is corrected to face the keyboard; her wrists are slightly lower and her finger curl is smaller. The male typing animation is unchanged.

Reproduction, using Blender 5.2 LTS:

```sh
blender --background --python-exit-code 1 --python blender/inspect_rig.py -- shruti
blender --background --python-exit-code 1 --python blender/build_male_rig.py
blender --background --python-exit-code 1 --python blender/build_seated_character.py -- shruti
blender --background --python-exit-code 1 --python blender/build_seated_character.py -- vinay
blender --background --python-exit-code 1 --python blender/animate_character.py -- shruti
blender --background --python-exit-code 1 --python blender/animate_character.py -- vinay
blender --background --python-exit-code 1 --python blender/repair_character_surface.py -- shruti
blender --background --python-exit-code 1 --python blender/repair_character_surface.py -- vinay
npm run assets:characters
```

The first two steps expect the downloaded `blender/source/shruti-rig.glb` and `vinay-remesh.glb`. `*-seated.blend` contains editable skeletal controls and guide furniture using the website's dimensions. `*-typing-source.blend` preserves animated controls; `*-typing.blend` contains the baked export action; `*-surface.blend` contains the padded UV maps. `render_hands.py` produces keyboard close-ups. `refresh_surface_pose.py` can transfer an existing padded surface to a revised skeletal animation, asserting that the vertices still match. Large generated projects and raw downloads remain local and are ignored by Git; the runtime GLBs and reproduction scripts are committed. The older `refine_characters.py` facial experiment remains disabled.

## Room: Blender look-dev and baked lighting

Blender is the source of truth for the room. The web renders it unlit: one merged mesh multiplied by a baked albedo atlas and a baked lightmap (`MeshBasicMaterial` map × lightMap), so the room costs one draw call and no real-time lights. Only the characters, the sign and the city view are lit or animated live. Research and trade-offs are in `docs/web-rendering-2026.md`.

Reproduction, using Blender 5.2 LTS (Metal GPU) from the repository root (`blender` = the Blender binary):

```sh
blender --background --python-exit-code 1 --python blender/build_cozy_room.py          # cozy layout → blender/studio-cozy.blend
python3 blender/fetch_polyhaven_props.py && python3 blender/fetch_polyhaven_textures.py   # CC0 props and textures
blender --background blender/studio-cozy.blend --python-exit-code 1 --python blender/dress_cozy_room.py
blender --background --factory-startup --python-exit-code 1 --python blender/build_furniture.py   # → furniture-library.blend
bash blender/meshy_batch.sh && bash blender/meshy_collect.sh                               # Meshy models (credits; see below)
blender --background --python-exit-code 1 --python blender/assemble_cozy_room.py       # → studio-assembled.blend
for c in "guy6 vinay 1.0" "girl shruti 1.0" "chibi-guy vinay 1.35" "chibi-girl shruti 1.35"; do
  blender --background --factory-startup --python-exit-code 1 --python blender/seat_meshy_character.py -- $c; done
cp blender/generated/guy6-seated.glb blender/generated/guy-seated.glb                     # classic Vinay is the Meshy 6 guy
blender --background --python-exit-code 1 --python blender/place_characters.py -- adult   # and -- chibi
blender --background blender/studio-adult.blend --python-exit-code 1 --python blender/bake_cozy_room.py -- 4096 256
blender --background blender/studio-adult.blend --python-exit-code 1 --python blender/export_live_props.py
blender --background --factory-startup --python-exit-code 1 --python blender/prepare_cat.py   # Puszek → blender/generated/cat.glb
npm run assets:room && npm run assets:characters && npm run assets:cat                    # → public/studio, public/characters
```

- `build_cozy_room.py` starts from `studio-portfolio.blend` (the earlier web room plus characters), shrinks the shell and rearranges the furniture. The desk and characters keep their positions.
- `dress_cozy_room.py` adds Poly Haven props (CC0) and the Meshy toy car (`blender/source/meshy/toy-car.glb`, generated in the studio's Meshy workspace).
- `lookdev_cozy.py` sets the warm evening light rig, practical lamps, wall colours, hero camera, soft bevels and AgX view. Both `render_cozy.py` and `bake_cozy_room.py` apply it.
- `bake_cozy_room.py` unwraps each part, packs them into one atlas at weighted texel density, bakes a 4K albedo and a 2K diffuse lightmap, and exports the merged room, cut-out leaves and glow meshes.
- `build_furniture.py` builds the hard-surface furniture (desk, cabinets, shelving, lamps, rug, framed art) at real size with Poly Haven wood, metal and jute textures. `assemble_cozy_room.py` replaces the old web furniture with it and with the Meshy models (characters, sofa and cushions, chairs, plants, laptops, desk props), generated from the reference PNGs in `output/meshy-reference-assets-2026-10-31/v2/` (brief: `output/meshy-image-brief.md`). `blender/review-models.html` previews every Meshy model next to its reference (served by `npm run dev`).
- `seat_meshy_character.py` seats a Meshy-rigged character: it joins the imported bone tails to the next joint, adds two finger bones per hand, keeps the head and long hair rigid, poses the body with IK and bakes `TypingIdle` (8 s) plus an upper-body `Wave` (2.6 s, the hand nearer the camera). `place_characters.py` seats a pair in the room and records where chairs and laptops go (`SEATS` in `src/scene/views.js`).
- Two character pairs ship: classic (`vinay`, `shruti`) and chibi (`vinay-chibi`, `shruti-chibi`). The top-bar toggle switches them; characters, office chairs and laptops are live meshes, not baked, so each pair sits at its own distance. Hovering a character plays the wave over the typing loop.
- Warm and night lighting are both baked; the website blends the two lightmaps.

## Behavior and checks

All six sections have HTML content and remain available if the 3D scene fails. Keys 1–6 open sections and Escape closes them. Phone dialogs trap and restore keyboard focus; desktop panels preserve navigation. Story pencil drawing, project hover treatment, process animation and contextual camera movement are retained. Character typing is enabled, with reduced-motion support. Fonts are bundled locally. Unconfigured social links are hidden; email copying reports failure correctly.

Night mode retains blue and pink accents but uses stronger hemisphere, key, desk and front fill lighting than the original deployment. Warm mode preserves the deployed lighting values. Browser rendering pauses in hidden tabs; idle animation runs at approximately 24 fps when motion is enabled.
