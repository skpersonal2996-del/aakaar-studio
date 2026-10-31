# Character review — 30 October 2026

**Current status: original faces preserved; seated models integrated locally.** The user resumed posing and animation after requesting the face-edit rollback. Both source Meshy v2 GLBs remain unchanged. The rejected Blender facial deformation and Meshy AI face-edit result are inactive.

The female rig was obtained from the available Meshy export. A second auto-rig request was Pro-gated; the male rig was therefore adapted and bound in Blender. No upgrade was purchased. The seated pose uses the original website's 49 cm chair cushion and 76.5 cm desk surface. Original face geometry and PBR skin textures are retained.

The first seated test exposed hair bound partly to the shoulder bones. A height-only correction and a narrow colour mask were insufficient and produced stretched strips. The final binding welds coincident UV seam positions, assigns the entire head and long hair to the head bone, and smooths body weights while locking that rigid region. Fresh side and rear renders show a continuous hair silhouette. The hair and face move rigidly with the head instead of stretching with the arms.

Both eight-second typing loops are baked and packaged for the browser. Independent wrist/ankle checks after constraint removal remain within 0.2 mm of the controls. `public/characters/` contains the runtime assets; `*-typing-source.blend` retains editable controls. Rigged models are integrated via `src/scene/Team.jsx` without changing the room's face-to-face layout.

Historical face-edit prompts below are provenance, not instructions to resume those rejected edits. Later user feedback about remaining visual differences should be evaluated against the supplied reference, rather than assuming the source appearance is an exact match.

## Earlier Blender review findings (superseded)

Reviewed the actual exported v2 Meshy GLBs, rather than their thumbnails or generated input pictures. The user's approved close-ups are the authority for faces and hair; the full board guides adult body proportions, clothing and seated posture. The rendered references are a target for visual similarity, not evidence of an exact reconstructable mesh.

## Findings and changes

| Area | Exported model findings | Editable Blender correction | Remaining difference |
| --- | --- | --- | --- |
| Skin | Too pale under review lighting; some surface shine | Warmer peach diffuse, nonmetallic matte shading, restrained specular and no skin normal relief | Final colour must also be checked under both website lighting modes |
| Cheeks | Female texture has blush; male colour was too faint | Soft spatial blush blended into the skin, without circular cheek geometry | Subtle colour can disappear at the room's widest camera distance |
| Eyes and face | Small black eyes and no mouth are present; male has a small nose nub and the lower faces are narrower than the sheet | Reduced specular response, softened the nose profile and gently widened lower cheeks using a continuous spatial deformation | Face outline and eye-edge detail still vary from the reference |
| Male hair | Broad swept locks are much closer than the first procedural curls, but crown and tips remain exaggerated | Darker espresso finish, matte roughness and slightly reduced upper-crown volume | Locks are still more spiky and regular than the reference's flowing, interlocking waves |
| Female hair | Swept fringe and long waves are present; bun reads as an oversized top knot | Reduced bun size and moved it down and back while preserving the front crown | Fine strand flow, front-piece thickness and bun attachment still need a final sculpting check |
| Knitwear | Correct charcoal and ivory wardrobe; diffuse texture alone looks too smooth | Fine yarn relief, rough matte surface, warmer ivory and deeper charcoal | Ribbing and fabric detail must survive texture baking and the web export |
| Body | Both exports have longer torso and legs than the rejected short trial | Adult proportions retained; scene authoring heights normalize scale only | Seated silhouette and arm reach have not yet been validated |

## Verification performed

- Rendered both original exported models as full-body figures and close-ups in Blender.
- Rendered the corrected geometry from front, three-quarter, side and back, plus full body and a warm-light counterpart.
- Compared the actual renders with the supplied enlarged faces and full character sheet. Neutral and warm renders use the same geometry, exposure and framing so lighting cannot hide material changes.
- Replaced a trial material assignment that produced triangle-level shading patches with one continuous texture-driven material. The later facial deformation was still rejected by the user; shader continuity did not make the facial shape acceptable.
- Corrected a crown deformation that folded the hair surface, then checked the side and back again. Spatial deformation is independent of UV seams so adjoining texture islands remain together.
- Preserved the original downloads and baseline projects. Review changes are separate and reversible.

## Files and reproduction

The source files are `blender/source/vinay-v2.glb` and `blender/source/shruti-v2.glb`. `inspect_character.py` produces baseline `*-character.blend` projects. `refine_characters.py` produces `vinay-review.blend`, `shruti-review.blend` and the six review views per character in `blender/generated/`. The scripts exit nonzero on Blender errors.

Open `blender/review.html` directly, or use `/blender/review.html` on the Vite development server, for the interactive comparison. The raw GLBs, generated Blender projects and render outputs remain local and are ignored by Git. The approved references and reproduction scripts are kept with the project.

## Before integration

This review does not establish a final match or animation readiness. Procedural material changes need baking to portable GLB textures. Auto-rigging, seated hip/knee/elbow deformation, hair weighting, fingers, keyboard contact and typing animation remain separate checks. Do not replace the original scene layout or claim typing is verified from a standing preview.
