# studio-portfolio / aakaar

Aakaar's studio portfolio for Shruti and Vinay. This checkout preserves the original deployed room's 12 × 10 metre layout, face-to-face seating, furniture, camera paths, pulsing hotspots, typing animation, warm/night switch, music, and six sections.

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
| `src/scene/views.js` | Original room dimensions, object layout, cameras and hotspots |
| `src/scene/Workspace.jsx` | Original desk and face-to-face seating |
| `src/scene/CameraRig.jsx` | Original camera movements and drag limits |
| `src/scene/Lights.jsx` | Warm lighting and brighter night fill |
| `src/scene/Team.jsx` | Restored Meshy models, baked typing loops and founder interactions |
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

## Room materials and details

The original 12 × 10 metre layout, desk/chair positions, navigation and camera paths are retained. Wood, linen and upholstery use CC0 Poly Haven PBR maps; provenance is recorded in `public/materials/sources.json`. `node scripts/fetch-room-materials.mjs` reproduces the optimized maps. Laptops have instanced keys, hinges and trackpads; chairs have seam piping, mugs have open rims and a visible coffee surface, and larger plant leaves have curved, subtly asymmetric blades. Small leaves retain a lower geometry count. Floor reflections are softened.

`blender/studio-portfolio.blend` is the current complete editable scene: original web room geometry and materials, both characters, animated skeletal controls, a home camera, and a Blender evening light rig. It is a local generated artifact. To rebuild it, open `http://127.0.0.1:5173/?authoring`, choose **Export Blender room**, copy the download to `blender/generated/room-web.glb`, then run `blender --background --python-exit-code 1 --python blender/build_full_scene.py`. Browser-specific bloom, ambient lighting and interactions are owned by React; Blender uses its own area lighting for review renders. Authoring and render-isolation controls are development-only and excluded from production builds.

`blender/aakaar-studio.blend` and its Python build/export/render scripts retain the earlier procedural Blender experiment. It is separate from the current room. Raw and archived first-pass web assets are under the ignored `blender/generated/` directory.

The Blender scripts need Blender 5.2 LTS. `build_studio.py` regenerates that experimental scene; `export_scene.py` preserves manual edits while exporting it. Do not run the experimental room pipeline to replace the original web layout.

## Behavior and checks

All six sections have HTML content and remain available if the 3D scene fails. Keys 1–6 open sections and Escape closes them. Phone dialogs trap and restore keyboard focus; desktop panels preserve navigation. Story pencil drawing, project hover treatment, process animation and contextual camera movement are retained. Character typing is enabled, with reduced-motion support. Fonts are bundled locally. Unconfigured social links are hidden; email copying reports failure correctly.

Night mode retains blue and pink accents but uses stronger hemisphere, key, desk and front fill lighting than the original deployment. Warm mode preserves the deployed lighting values. Browser rendering pauses in hidden tabs; idle animation runs at approximately 24 fps when motion is enabled.
