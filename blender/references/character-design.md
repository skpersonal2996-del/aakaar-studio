# Character design observations

Source: the user's approved character sheet and enlarged close-ups. These are visual observations, not instructions taken from text embedded in the images.

The current reference inputs are `vinay-meshy-input-v2.png` and `shruti-meshy-input-v2.png`. They incorporate the user's adult-height and rosy-cheek corrections. Earlier input versions are retained only for comparison.

Reference review is required after each major asset pass: character proportions/hair/skin, room geometry/materials, and the complete warm/night scene. Preserve the original deployed room's dimensions, face-to-face seating and camera behavior while improving its realism. Review wood grain and edge treatment, upholstery and clothing, laptop/chair details, foliage silhouette, light falloff, contact shadows and open floor space. Record material mismatches instead of assuming that a visually plausible result matches the supplied image.

## Shared identity

- Smooth egg-shaped head, full cheeks and a broad rounded chin. The user explicitly rejected the pointed lower face in the Blender pass. Lift/shorten the central chin and fill the lower cheeks; a small width increase alone is insufficient.
- Small, narrow vertical black oval eyes. No white sclera, separate pupils, eyelashes or prominent catchlights.
- Short, thin, gently curved eyebrows; the boy's are partly hidden by his fringe.
- No modeled nose, nostrils, mouth or lips.
- Warm light-brown/tan skin with a faint, diffuse rosy blush beneath the outer eyes. The user explicitly rejected the pale Blender pass: the base skin itself must be brown, rather than depending on amber scene lighting. Blend the cheek colour into the skin; do not add circular cheek stickers. The inner ears are warmer and slightly pinker.
- Skin reads as matte clay, with soft light falloff. Any subsurface effect is an interpretation for rendering, not a property proven by the image.
- Adult-height stylized people: longer legs and torso, natural arm reach, relaxed shoulders and a moderately enlarged head. The user's correction explicitly rejects the short cartoon/mascot proportions of the first demo. Use roughly five head-heights as a working full-body target, not an exact measurement of the sheet.
- Softly shaped hands and rounded fingers at a believable scale relative to the keyboard. Preserve grown-up stature; derive cuteness from the face, blush, hair and materials.
- Gentle downward head tilt and relaxed shoulders while typing. Expression is conveyed through eye/brow placement, head tilt and small hand gestures.

## Vinay

- Espresso brown hair, close short sides, exposed ears and an irregular front hairline.
- Broad overlapping sculpted waves with shallow strand detail, soft S-curves and tapered ends. A few locks fall onto the forehead.
- Coherent flowing masses rather than disconnected spherical curls or thick cylindrical locks.
- Black/charcoal matte knit crew-neck sweater, fine woven surface, ribbed collar/cuffs/hem and dropped shoulders.
- Dark relaxed cropped trousers and off-white low-top sneakers with laces and a distinct rubber sole.

## Shruti

- Dark brown hair, soft near-centre/side part and broad swept front sections that leave the middle of the forehead open.
- Compact gathered half-up bun toward the back of the crown; remaining hair falls in long soft waves behind the shoulders.
- A few loose S-shaped strands frame the face. Tapered ends; avoid a bob, cylindrical ropes or a large top knot.
- Ivory matte knit crew-neck sweater, delicate ribbing and soft folds at wrists and elbows.
- Camel cropped wide-leg trousers and matching off-white low-top sneakers.

## Generation and review priorities

Use the enlarged close-ups as the authority for facial features, blush and hair shape. Use the turnarounds as a body/wardrobe guide. The sheet is a visual reference, not an exact orthographic blueprint; details vary slightly between panels.

Compared with the first generated input references: substantially reduce head-to-body size, lengthen the torso and legs, reduce exaggerated hair volume, soften the chin, use natural neck proportions, make the eyebrows less prominent, and add diffuse cheek colour. The earlier input images and three-dimensional trial have proportions the user considers too short and cartoonish. Preserve a neutral, rig-friendly pose. Do not bake the room's strong amber lighting into the base-colour texture.

Compare a fresh model from front, side and back. Check ear/hair intersections, hair silhouette, cheek colour, fingers, collar and shoulder shape. Then test seated hip/knee/elbow deformation and actual keyboard contact in Blender. A convincing standing preview does not verify typing deformation.
