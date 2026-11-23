# Client Renderer (`packages/client/src/render`)

Isolated PixiJS v8 rendering subsystems:
- `textures/`: `32×32` Cainos-style pixel terrain tiles (`terrainTextures.ts`, `terrainTileDetails.ts`, `terrainTileMotifs.ts`), `3×` HD-pixel (`48 px/tile`, `HD_PROP_SCALE = 1 / 3`) foliage & world props (`hdFoliageTextures.ts`, `hdPropTextures.ts`, `hdFireTextures.ts` 2× roaring hearth campfire & pixel-fire torches, `propTextures.ts`), `spriteManifest.ts` (`scaleMode: "nearest"` preloader for crisp `2px` creature/POI sheets), and solid `sel-out` canvas helpers (`pixelCanvas.ts`) tuned by `@dc2d/content` (`ACTIVE_OUTLINE_STYLE`).
- `combat/`: `EntityRenderer` + `entityAnimator.ts` 4-dir / 8-dir spritesheet animator with waterline deep-water `waterMask` clipping & ripples (`entitySprites.ts`), world pickups, diegetic AI state indicators, and gore/VFX (`GoreSystem.spawnClashSparks` for iron-on-stone golem hits).
- `shaders/`: WebGL2 GLSL GPU tilemap shader (`tilemapMesh.ts`), water, canopy wind, lighting composite, cast shadows, and pooled GPU `AmbientParticleLayer` (`mote`, `leaf`, `firefly`, `ember`, `flame`, `ripple`, and `playerLeave` `smoke` clouds).
- `world/`: `32×32` chunk setup, elevated cliff strips, `PlayerView` + baked-arm/bow-armless sprites, base-anchored lever foliage sway, and Option A integer-aligned zoom camera orchestration.
