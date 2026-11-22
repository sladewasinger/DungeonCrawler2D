# World Scene (`packages/client/src/render/world`)

PixiJS v8 world rendering layer:
- `tileBuilder.ts`: Bakes `512×512` chunk terrain & water textures once per chunk with cliff strata, stairs, and organic biome edge blending.
- `playerSprite.ts`: Loads `/assets/atlas.json` knight animations (with procedural fallback) and carried flickering torch overlay.
- `chunkRenderer.ts`: Streams visible chunks, Y-sorts props/actors, animates campfires/torches, rustles tall grass, and smoothly fades canopies when walking behind trees.
- `worldScene.ts`: Orchestrates camera zoom/follow, multi-pass WebGL2 shaders, cast shadows, and ambient particles.
