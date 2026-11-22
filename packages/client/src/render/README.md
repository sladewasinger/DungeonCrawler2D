# Client Renderer (`packages/client/src/render`)

Isolated PixiJS v8 rendering subsystems:
- `textures/`: Pixel-art terrain tile painters, foliage/campfire/torch sprites, `spriteManifest.ts` (`64×64` PNG preloader with `scaleMode: "nearest"` from `/assets/sprite-manifest.json`), and 1px outline helpers.
- `shaders/`: Custom WebGL2 GLSL filters (water, foliage wind, lightmap + rim + bloom + god-rays + clouds + mist + grading), directional cast shadows, and pooled GPU particles.
- `world/`: Infinite chunk texture baking, streaming, canopy alpha fade, and camera orchestration.
