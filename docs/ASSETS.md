# Demonstration assets

No private asset, letter, name, recording, soundtrack or vendor texture from the original gift was used. Public characters Alex and Sam and their stories are fictional. No music is bundled.

`public/demo-coast.webp` was generated with the built-in Image Gen tool, then converted/resized with Sharp. Its generation prompt was:

> Standalone production demo photograph for fictional Polish emotional digital gift platform blisko. Wide landscape 3:2 editorial analogue photograph of two fictional adults seen entirely from behind sitting closely on a rocky coast at sunset, ocean horizon, small setting sun to right, muted apricot sky, slate sea, dark grass foreground, tender and quiet, natural film grain, elegant desaturated warm colors. No text no logos no UI no frames. This is wholly fictional stock-like scene with no reference to any real person. Composition with people lower left, plenty of sky. High quality atmospheric photography.

Generated design references, also produced with built-in Image Gen:

- `docs/editor-concept.png`: full editor, ivory/ink/terracotta, editorial typography, sidebar, ordered scenes and midnight film preview.
- `docs/home-concept.png`: storefront hero and experience catalogue in the same system.
- `docs/storefront-lower-concept.png`: process, open package comparison, FAQ and footer.

The first two references contain Polish copy because their generation began before the user switched the task to English. Implementation copy follows the later English instruction. References are design documentation, not flattened application UI. The actual interface is HTML/React, and the 3D experience is Three.js.

Other previews show code-native product UI, not third-party photographs. The restored gift uses locally bundled Cormorant Garamond, Caveat and Inter from Fontsource, plus the original Fredoka/Nunito fonts recovered with the parent menu stylesheet, with OFL license notices in `public/original/licenses`. Icons and runtime libraries come from declared npm dependencies. Restored Three.js/OrbitControls files retain upstream license headers; original private media and vendor textures are excluded. See `RESTORATION.md` for the fidelity limits.

