# World Scene (`packages/client/src/render/world`)

PixiJS v8 world rendering layer:
- `tileBuilder.ts`: Bakes `512×512` lower ground & water textures with ambient-occlusion cliff shadows and rounded shoreline masks.
- `cliffStrips.ts`: Bakes Y-sorted 3/4 lifted plateau row strips (`10px` per tier) with bevel rims, vertical cliff strata, and sloped staircases for smooth player occlusion.
- `playerSprite.ts`: Loads `/assets/atlas.json` knight animations (with procedural fallback), active held-item rendering, carried flickering torch, and smooth stair/elevation lift.
- `chunkRenderer.ts`: Streams visible chunks, Y-sorts props/cliffs/actors, animates campfires/torches, rustles tall grass, and smoothly fades canopies when walking behind trees.
- `worldScene.ts`: Orchestrates camera zoom/follow, multi-pass WebGL2 shaders, cast shadows, and ambient particles.
