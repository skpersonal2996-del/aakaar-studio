# Web rendering for the studio scene (October 2026)

What this covers: how to ship a cozy, stylized, "animated-movie" interior with baked Cycles lighting and two skinned characters, on desktop and phones, in the browser.

Researched 2026-10-31. Versions come from the GitHub releases pages and the npm registry on that date. Statements marked *(secondary)* come from blogs and have not been checked against primary docs.

## TL;DR

- **Lighting:** bake **diffuse lighting only** (Direct + Indirect, Color off) from Cycles into **one lightmap atlas per theme** on `uv2`. Multiply it by the existing albedo maps on `uv1`, and render the room with almost no real-time lights.
- **Characters:** they sit at fixed desks, so light each one with a **local cube capture of the lightmapped room**, converted to a PMREM env map. Add one key light and one rim light. Bake their **contact shadows and AO into the room lightmap** by putting proxy characters in the Blender bake.
- **Renderer:** stay on **WebGL2**. Do upgrade the stack to **React 19, R3F 9.8, drei 10.7, @react-three/postprocessing 3.2, postprocessing 6.39 and three 0.186**. Move to WebGPU when R3F v10 is stable.
- **Assets:** keep **Meshopt** and switch all textures to **KTX2** (UASTC for color, normals and lightmaps; ETC1S for ORM). That alone cuts character VRAM by about 4x.
- **Post-processing:** run **one merged pass**: Bloom (mipmap), AgX tone mapping, vignette and grain, with SMAA on phones. **Remove N8AO**, because the AO is already baked.
- **Gaussian splats:** viable in 2026 (Spark 2.4), but **not a fit** for this room: you would lose lighting and occlusion control around the characters and the interactive props.

---

## Current state (what the repo does today)

`src/scene/Studio.jsx` and `Lights.jsx` currently run:

- 16 real-time lights, 3 of them shadow-casting spots (2048 and 1024 maps), plus `SoftShadows` (PCSS, 12 samples).
- Ambient, hemisphere and `Environment` lighting, with `N8AO` on top.
- `EffectComposer multisampling={4}` with ACES tone mapping.

Every one of these costs something on every frame. Baking removes nearly all of them.

The characters (`public/characters/*.glb`) are about 103K tris, 36 joints and one 8 s clip each. Geometry is roughly 1 MB of each file. **About 6 MB of each file is lossless WebP** (two 2048² maps and one 1024² map). Once decoded, the textures alone take about 45 MB of VRAM per character (RGBA8 with mips).

---

## 1. Baked lighting delivery

### Options

| Approach | How it works | Pros | Cons |
|---|---|---|---|
| **A. Lightmap on uv2** (recommended) | Bake Diffuse (Direct + Indirect, Color off). three: `material.lightMap = tex; tex.channel = 1`. | Albedo stays at full tiling resolution. The lightmap is low-frequency, so 2048² covers the whole room. Two themes means two small lightmaps. Specular can stay live. | Two UV sets. The lightmap travels outside glTF (no standard slot). Needs an intensity calibration. |
| B. Combined into base color (unlit) | Bake Combined into a unique-UV atlas; use `MeshBasicMaterial` or `KHR_materials_unlit`. | It looks exactly like Cycles from the baked camera, needs zero shading cost, and exports natively in glTF. | Detail is capped at the atlas texel density, which means multiple 4096² atlases for close-ups. Specular is frozen and goes wrong off-angle. Each theme needs a full set of atlases. |
| C. Combined: A for the room, B for hero props | Unique-UV props such as the sign, art and shelf get a full bake. Large tiling surfaces use A. | You can pick per object. | Two material paths to maintain. |

**Pick A**, and use C selectively. The site already has a warm and a night theme, so A means shipping **2 × one 2048² lightmap** instead of 2 × several 4096² full-color atlases.

**Intensity calibration (three r169 source, verified).**

- `MeshStandardMaterial` adds `lightMap * lightMapIntensity` as *irradiance*, then multiplies it by `albedo / π`.
- `MeshBasicMaterial` multiplies the lightmap by `RECIPROCAL_PI` directly.
- A Cycles Diffuse bake with Color off stores what a white surface reflects, which is E/π.

So set **`lightMapIntensity = Math.PI`** on both material types. Also:

- **Remove the ambient, hemisphere and environment-diffuse contributions on the room**, or they add a second layer of light on top of the bake.
- If you keep `MeshStandardMaterial` for glossy surfaces, drop `envMapIntensity` to about 0.1–0.3. On r169 the env map also adds diffuse IBL.
- Use `MeshBasicMaterial` (or Lambert with no lights in range) for matte room surfaces. Real-time lights then cannot touch them.

**Theme crossfade without shader patches.** For about 1 s during a theme change:

1. Blend `lightmapWarm` and `lightmapNight` into a 2048² `WebGLRenderTarget` with a fullscreen quad.
2. Point `material.lightMap` at that target while the blend runs.
3. Swap to the compressed night (or warm) texture when the blend ends.

This avoids `onBeforeCompile` hacks, which would block a later WebGPU port.

### Blender 5.2 bake workflow

The manual is now "Blender 5.2 LTS" ([manual](https://docs.blender.org/manual/en/latest/render/cycles/baking.html)).

1. **UVs.**
   - Add a second UV map named `Lightmap` to every static mesh.
   - Make the bake UV the **active** UV map. Bake writes through the active map; the materials keep sampling albedo from UV0 through a UV Map node.
   - Unwrap with Smart UV Project or Lightmap Pack. Then do the packing in one multi-object Edit Mode session:
     - **Average Islands Scale**, so texel density is uniform.
     - **Pack Islands** with Shape Method *Exact* (the 3.6+ packer), Rotate on, and Margin Method *Fraction* at about 0.004. That is roughly 8 px at 2048².
2. **Texel density.**
   - The room is about 210 m² of walls, floor and ceiling, plus about 100 m² of props.
   - 40–64 px/m fills one 2048² atlas at about 60% packing efficiency.
   - Hero props near camera presets can get 2× scale; hidden faces (underside of the sofa, backs of the shelves) can get 0.25×.
3. **Bake.**
   - Cycles, GPU, 1024–4096 samples with adaptive sampling. Bake type **Diffuse**, Contributions **Direct + Indirect**, **Color off**.
   - Margin Type *Extend*, 8–16 px.
   - Target: a **32-bit float** image, saved as EXR.
   - One image node, referencing the same image and set as the active node, in every material. Then bake all selected objects in one pass.
   - Put **low-poly proxy characters** in their seated poses into the bake, with "visible to camera" off. Their contact shadows and AO land on the chairs, desks and floor.
4. **Denoise.** Cycles does not denoise bakes.
   - Run the EXR through the compositor: Image node → **Denoise** (OIDN), with HDR on. Write the result.
   - A margin of at least 8 px keeps the denoiser from bleeding across islands.
5. **Two themes.** Toggle a light collection for each theme (warm / night) and bake both. Script this with `bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT','INDIRECT'}, margin=16)`.
6. **Export.**
   - The glTF exporter writes the second UV map as `TEXCOORD_1`.
   - The lightmap does **not** go into the glTF. Encode it separately (see below) and assign it in code to meshes tagged with `userData.lightmap = true`, set through a custom property.

**The Lightmapper addon (Naxela).** The last release is 0.7.0 (Oct 2024). Open issues report breakage on Blender 4.2 and 4.3, and a "Lightmapper-One" rewrite is WIP. **Do not depend on it for 5.x.** Native bake plus a roughly 50-line script is enough ([repo](https://github.com/Naxela/The_Lightmapper)). The paid alternative "Baker" lists support for Blender 4.0–5.2 ([Superhive](https://superhivemarket.com/products/baker-gpu-lightmapper-for-blender/docs)).

**Tone mapping match.** Blender's default view transform is AgX. Bake in linear, and set three's output to `AgXToneMapping` (available since r160) at the same exposure, so the two looks line up.

### Lightmap encoding

| Format | Download | VRAM (2048², mips) | Notes |
|---|---|---|---|
| **LDR sRGB, KTX2 UASTC + Zstd** (recommended) | about 1.5–3 MB | about 5.3 MB (ASTC/BC7) | Scale the bake so the 99th-percentile value is about 1.0 and store it as sRGB, which gives dark tones more precision. Keep the scale in `lightMapIntensity` (π × scale). The cozy interior's range fits comfortably. Bright lamps are emissive meshes anyway. |
| LDR, KTX2 ETC1S | about 0.5–1 MB | about 2.7–5.3 MB | Blocky on smooth gradients. Fine for a low-res mobile tier. |
| HDR, KTX2 UASTC HDR | larger | about 5.3 MB | Supported in KTX2Loader since r170. Native on ASTC-HDR GPUs, transcoded to BC6H on desktop, decompressed to half float elsewhere. Encode with `basisu`. Only worth it if the bake genuinely needs more than about 4× headroom ([forum](https://discourse.threejs.org/t/exr-conversion-to-ktx2-mac-system-rendering-exception/73950)). |
| HDR, UltraHDR JPEG (`UltraHDRLoader`) | small | **32 MB** (half float, uncompressed) | Small on the wire but expensive in VRAM. Skip. |
| RGBM PNG | medium | 21 MB | Needs a custom decode. Obsolete now that UASTC exists. |

Command (KTX-Software 4.4.2 stable; 5.0 is in RC):

```
ktx create --format R8G8B8_SRGB --encode uastc --uastc-quality 2 --zstd 18 --generate-mipmap lm_warm.png lm_warm.ktx2
```

---

## 2. Lighting the characters inside a baked room

The characters do not walk around; they sit at fixed desks. So the cheapest **and** best-matching approach is per-character local IBL:

- **Per-character local env map** (works on r169, no upgrade needed).
  1. After the lightmapped room renders, run one `CubeCamera` capture (64–128 px) at each character's head or chest.
  2. Convert it with `PMREMGenerator.fromCubemap()` and assign the result as that character's `material.envMap`.
  3. Re-capture on theme change. That is two captures, each a few ms.

  This gives diffuse and specular light that *is* the baked room, including the warm or pink bounce.
- **Add one key and one rim light** (directional or spot) for the stylized "animated-movie" read. The room is unlit or lightmapped, so these lights barely affect it.
- **`LightProbeGrid`** is the right tool if characters ever move around.
  - It was added in **r184** for WebGL (`three/addons/lighting/LightProbeGridWebGL.js`) and also exists for WebGPU (`LightProbeGrid.js`).
  - It is an L2 spherical-harmonic grid, baked on the GPU at runtime from the scene. That means it captures your lightmapped room, and it supports multi-bounce.
  - It is still being actively fixed in r187: it double-counted light with the environment ([#34743](https://github.com/mrdoob/three.js/pull/34743)), and materials compiled before the first bake were not lit ([#35202](https://github.com/mrdoob/three.js/issues/35202)).
  - It requires three ≥ 0.184 ([PR #33125](https://github.com/mrdoob/three.js/pull/33125), [docs](https://threejs.org/docs/pages/LightProbeGrid.html)).
- The old single `LightProbe` and `LightProbeGenerator` path is global (one probe for the whole scene). It is OK only if both characters share similar light.
- **Contact shadows.** The proxy-character bake (§1) covers static contact. For the arm and hand motion of typing, add a soft blob decal: a transparent quad with a radial gradient under the forearms and hands. Do **not** use drei `<ContactShadows>`, which re-renders depth every frame, or real-time shadow maps.
- Drop `SoftShadows` (PCSS) entirely.

---

## 3. Renderer: WebGPU or WebGL2

**Versions as of 2026-10-31:**

| Package | Version |
|---|---|
| three | **r187** (0.187.0, released 2026-10-30) |
| R3F | **9.8.2** stable; **10.0.0-alpha.6** makes WebGPU the default (WebGL moves to `@react-three/fiber/legacy`, [PR #4013](https://github.com/pmndrs/react-three-fiber/pull/4013)) |
| drei | 10.7.9 stable; 11 alpha |
| postprocessing | 6.39.5 (peer `three <0.187`); v7 is in beta (last beta Feb 2026) |
| @react-three/postprocessing | 3.2.2 (needs R3F ≥ 9.7 and React 19) |

- **R3F 9** supports WebGPU through an async `gl` callback that returns `new WebGPURenderer(...)` after `await renderer.init()` ([v9 migration](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)). `WebGPURenderer` falls back to a WebGL2 backend when WebGPU is unavailable.
- **Browsers.** Chrome and Edge (desktop and Android 121+) and Safari 26 (macOS and iOS 26, Sept 2025) ship WebGPU by default. Firefox ships on Windows and macOS. As of Aug 2026, **Firefox on Android and Linux is still pre-release only** ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [web.dev](https://web.dev/blog/webgpu-supported-major-browsers)).
- **The three ecosystem is moving WebGPU-first.**
  - r186 added a TSL Gaussian splat addon ([#33950](https://github.com/mrdoob/three.js/pull/33950)).
  - r187 added an in-browser `LightMapper`, a UV unwrapper and VXGI, **all WebGPU-only** ([#34991](https://github.com/mrdoob/three.js/pull/34991)).
  - `ShaderMaterial` and `onBeforeCompile` do not work under `WebGPURenderer`.
  - pmndrs `postprocessing` is WebGL-only; WebGPU uses three's TSL post nodes instead.
- **Verdict: stay on WebGL2 for this project.** A baked scene is texture-bound and has few draw calls. WebGPU would not speed it up meaningfully, and migrating means rewriting the post-processing chain, any GLSL, and drei helpers.
- **Do upgrade within WebGL now.**
  - `@react-three/postprocessing` 2.x caps three at **<0.184**. That blocks `LightProbeGrid` and every fix since then.
  - Target: React 19 + R3F 9.8 + drei 10.7 + @react-three/postprocessing 3.2 + postprocessing 6.39.5 + **three 0.186.x** (postprocessing's peer range excludes 0.187).
- **Revisit WebGPU when R3F 10 is stable.** Keep new shader work in plain material properties so the port stays cheap.

---

## 4. Geometry and texture compression

- **Meshopt over Draco**, still.
  - Meshopt has a small, fast decoder and compresses animation and morph data, which the skinned characters need. It also stacks well with Brotli/gzip.
  - Draco only wins on static geometry size, and pays for it with WASM size and slower decode.
  - meshoptimizer is at **v1.3** (Sept 2026).
  - three has loaded `KHR_meshopt_compression` since r183 ([#32163](https://github.com/mrdoob/three.js/pull/32163)). glTF-Transform 4.5.1 still writes `EXT_meshopt_compression`, which is fine.
- **Characters.** Change `scripts/optimize-characters.mjs`:
  - Lossless WebP → `uastc` for `baseColorTexture` and `normalTexture` (`--level 2 --rdo --zstd 18`; normals via `ktx create --normal-mode`). `etc1s --quality 200` for ORM.
  - Expected result: about 2–3 MB download and **about 11 MB VRAM per character**, down from about 45 MB.
  - Add a **mobile LOD**: `simplify --ratio 0.4 --error 0.001` to about 40K tris, with 1024² textures. Load it when `PerformanceMonitor` or `navigator.hardwareConcurrency` / DPR suggests a phone.
  - Check skin weights after simplifying.
- **Room pipeline.** Use explicit glTF-Transform steps, **not blanket `optimize`.** Its defaults (`--flatten --join --instance --palette --simplify`, all `true`) would break named interactive nodes, and instancing makes **instances share one lightmap region**.

  ```
  gltf-transform dedup → prune → weld → resample
  → join (keep named interactive nodes separate; join static meshes per material to cut draw calls)
  → simplify --ratio 1 --error 0.0005 (plants and props only)
  → resize --width 2048 --height 2048
  → uastc --slots "{baseColorTexture,normalTexture,emissiveTexture}" --level 2 --rdo --zstd 18
  → etc1s --slots "{occlusionTexture,metallicRoughnessTexture}" --quality 200
  → meshopt --level high
  ```

  (CLI flags verified against glTF-Transform 4.5.1, [docs](https://gltf-transform.dev/cli). KTX steps need the `ktx` binary from KTX-Software on PATH.)
- **Instancing.** Use it only for objects that do **not** carry a unique lightmap: books, leaves, cables. Light those with AO baked into vertex color, or just albedo plus the local env map. Lightmapped meshes get *joined*, never instanced.
- **LOD.** The camera has only about 7 fixed presets, so frustum and preset-specific culling beats distance LOD. Hide objects that are never visible from the current preset.
- **Budgets.**

  | | Phones (mid-range) | Desktop |
  |---|---|---|
  | Texture VRAM | ≤ 128 MB | ≤ 512 MB |
  | Draw calls | ≤ 120 | ≤ 300 |
  | Scene triangles | ≤ 400K | 1–2M |
  | Initial download | ≤ 8 MB before first interaction | ≤ 8 MB before first interaction |

  Always use KTX2: WebP and PNG decode to full RGBA8 in VRAM, and iOS Safari kills tabs that use too much memory.

---

## 5. Post-processing on a budget

- **Use one `EffectComposer`** (pmndrs postprocessing 6.39.5 merges effects into a single pass). Order: Bloom (`mipmapBlur`, `luminanceThreshold` ≈ 1.0 so only emissive lamps, neon and screens glow, `resolutionScale` 0.5) → ToneMapping → Vignette → Noise.
- **Tone mapping.** Switch ACES → **AgX** (`ToneMappingMode.AGX`), or **Neutral** if colors go too desaturated. AgX matches Blender's default and handles saturated night neon without hue skew.
- **Film grain.** `Noise` (premultiply, opacity ~0.03–0.06) is nearly free and hides lightmap banding.
- **Depth of field.** Use it only on desktop, per preset with a fixed focus distance, at half resolution. Off on phones. It costs 1–3 ms or more on mobile.
- **Anti-aliasing.**
  - MSAA ×4 on the composer is fine on desktop at DPR ≤ 1.5.
  - On phones at DPR 2+, use **SMAA** (preset medium) or no AA. MSAA render targets at high DPR are bandwidth-heavy on tile-based GPUs.
- **Remove N8AO** (2.0.1). AO is in the lightmap, and SSAO at full resolution with MSAA is often the single most expensive pass on phones. If the characters look floaty, run N8AO at `halfRes` on desktop only.

---

## 6. Alternatives

- **Gaussian splats.**
  - **Spark 2.4.0** (MIT, World Labs; v2.0 in Apr 2026 added LoD trees and streamable `.RAD` files; runs on WebGL2 including iOS and Android) ([blog](https://www.worldlabs.ai/blog/spark-2.0), [repo](https://github.com/sparkjsdev/spark)). three r186 also has a minimal `GaussianSplatMesh` addon.
  - Splats composite with meshes through the depth buffer, so they *can* sit behind real-time characters. But the room's lighting is frozen into view-dependent splats, so:
    - you can't relight the room for the theme switch;
    - characters can't cast shadows onto it;
    - hover and click on props (`Interactive.jsx`) has no geometry;
    - you would need to train from many Cycles renders, which adds a capture pipeline;
    - an 8×7 m interior at good quality is 10–40 MB even with SPZ/RAD.
  - **Verdict: no for the room.** Possibly yes for the **city view outside the window**, as a single small splat or (cheaper) a parallax video.
  - Luma's web library and older gsplat libraries see little maintenance; prefer Spark.
- **Pre-rendered video hybrids.** For camera moves between the 7 presets, you *could* play Cycles-rendered transition clips and switch to real-time at rest. Drag-to-look and the live characters make the seams visible, and 7 × N transitions cost a lot of bandwidth. Not recommended. A **looping video texture** is fine for small elements: the city window, a monitor screen, rain.

---

## 7. Loading and runtime scaling

1. **Stage the load.**
   - **Stage 0:** HTML poster image of the default view (instant).
   - **Stage 1:** room GLB (geometry with ETC1S textures, under 4 MB) plus a **512² lightmap**. Render and fade in.
   - **Stage 2:** full 2048² lightmap and UASTC albedo swap.
   - **Stage 3:** characters, through a separate `Suspense` boundary after the first frame. `useGLTF.preload` them once the room is up.
   - Load the night-theme lightmap lazily on first toggle, or when idle (`requestIdleCallback`).
   - Lazy-load the code chunks too: `React.lazy` for postprocessing and DevSceneTools.
2. **Loaders.** With drei, `useGLTF(url, false, true, (loader) => loader.setKTX2Loader(ktx2))` gives Meshopt plus KTX2. Call `ktx2.detectSupport(gl)` once. Host the Basis transcoder locally.
3. **Precompile.** Call `gl.compile(scene, camera)` (or `compileAsync`) after load, so the first camera move doesn't hitch.
4. **Adaptive quality.**
   - Use drei `<PerformanceMonitor onDecline={…} onIncline={…} flipflops={3} onFallback={…}>` to step through tiers: DPR 1.5 → 1.25 → 1; then disable DoF, then bloom resolution, then MSAA → SMAA ([docs](https://drei.docs.pmnd.rs/performances/performance-monitor)).
   - Start phones at `dpr={[1, 1.5]}` (already the case).
   - Use `<AdaptiveDpr pixelated={false}>` only during camera transitions.
5. **Frame loop.** `frameloop="demand"` gives nothing while the characters animate.
   - Pause entirely when the canvas is off-screen (IntersectionObserver → `setFrameloop('never')`) or the tab is hidden.
   - On phones, cap to 30 fps: keep `frameloop="demand"` and call `invalidate()` from a 30 Hz timer that advances the mixers. That halves GPU and battery cost, and typing animation reads fine at 30.
   - At rest on desktop, render at full rate.
6. **Shadows.** After baking: `gl.shadowMap.enabled = false`. The room needs no shadow maps at all.

---

## Recommended pipeline for this repo

1. **Blender 5.2.**
   - Room and props in one file. Albedo materials on UV0, `Lightmap` UV on UV1 (packed into one 2048² atlas at about 48 px/m).
   - Proxy characters in place. Two light collections (warm, night).
   - Script: bake Diffuse (Direct + Indirect, no Color) for each theme → EXR → compositor OIDN → normalize → PNG.
2. **Encode.**
   - `ktx create … --encode uastc --zstd 18`, giving `lm_warm.ktx2` and `lm_night.ktx2` (plus 512² previews).
   - Export the glTF with `TEXCOORD_1`. Run the explicit glTF-Transform chain in §4: join static meshes, KTX2 textures, Meshopt. Never instance lightmapped meshes.
3. **Characters.** Switch WebP to UASTC/ETC1S. Generate a 40K-tri mobile LOD.
4. **Runtime (WebGL2, three 0.186, R3F 9.8).**
   - Room materials: `MeshBasicMaterial` or `MeshStandardMaterial` with `lightMap.channel = 1` and `lightMapIntensity = π × scale`. Remove all room lights, `SoftShadows`, the hemisphere and ambient lights, and the shadow maps.
   - Characters: per-character CubeCamera → PMREM env map, plus a key and a rim light, plus blob shadows. Re-capture on theme change.
   - Theme switch: GPU crossfade of the two lightmaps into a render target, then swap to the compressed texture.
   - Post: Bloom (half res) → AgX → Vignette → Noise. MSAA on desktop, SMAA on phones. No N8AO.
   - Load: poster → room with low lightmap → full lightmap → characters → night lightmap on idle. `PerformanceMonitor` tiers. 30 fps cap on phones. Pause when off-screen.
5. **Later.** Once R3F 10 is stable, evaluate WebGPU plus `LightProbeGrid` and three's in-browser `LightMapper` and VXGI.

## Sources

- three.js releases (r187, 2026-10-30): https://github.com/mrdoob/three.js/releases
- LightProbeGrid PR (r184): https://github.com/mrdoob/three.js/pull/33125 · docs: https://threejs.org/docs/pages/LightProbeGrid.html · env double-count fix: https://github.com/mrdoob/three.js/pull/34743 · first-bake bug: https://github.com/mrdoob/three.js/issues/35202
- three LightMapper / VXGI (r187, WebGPU): https://github.com/mrdoob/three.js/pull/34991
- three Gaussian splat addon (r186): https://github.com/mrdoob/three.js/pull/33950
- GLTFLoader KHR_meshopt_compression: https://github.com/mrdoob/three.js/pull/32163
- R3F v9 migration (async gl / WebGPU): https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide · R3F v10 WebGPU default: https://github.com/pmndrs/react-three-fiber/pull/4013
- pmndrs postprocessing releases: https://github.com/pmndrs/postprocessing/releases · react-postprocessing: https://github.com/pmndrs/react-postprocessing/releases
- drei PerformanceMonitor: https://drei.docs.pmnd.rs/performances/performance-monitor
- WebGPU browser status: https://en.wikipedia.org/wiki/WebGPU · https://web.dev/blog/webgpu-supported-major-browsers
- WebGPU migration checklist *(secondary)*: https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- Blender 5.2 baking manual: https://docs.blender.org/manual/en/latest/render/cycles/baking.html
- The Lightmapper: https://github.com/Naxela/The_Lightmapper · Baker (paid, 4.0–5.2): https://superhivemarket.com/products/baker-gpu-lightmapper-for-blender/docs
- glTF-Transform CLI 4.5.x: https://gltf-transform.dev/cli · KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases
- meshoptimizer releases: https://github.com/zeux/meshoptimizer/releases
- UASTC HDR in KTX2Loader: https://discourse.threejs.org/t/exr-conversion-to-ktx2-mac-system-rendering-exception/73950
- Spark 2.0: https://www.worldlabs.ai/blog/spark-2.0 · https://github.com/sparkjsdev/spark

## Unresolved questions

- Will characters ever move from their desks? If yes, use LightProbeGrid, which needs three ≥0.184.
- OK to upgrade to React 19 / R3F 9? It is required for three ≥0.184 because of the react-postprocessing peer range.
- Is the room geometry going to be authored in Blender? Today it is procedural in `src/scene/*`.
- Are the theme lightmaps truly two sets, or one set plus a night tint?
- Mobile character LOD acceptable at about 40K tris?
