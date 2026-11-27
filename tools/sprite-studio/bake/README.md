# Node Sprite Bakers (`tools/sprite-studio/bake`)

Node.js lossless `.webp` post-processing, outlines, spritesheet packing, and manifest synchronization scripts invoked by `../runBake.mjs` and `../runPlayerBake.mjs`:

- `bakeSpriteSheet.mjs` & `manifestSync.mjs`: Creature turntable packing & `sprite-manifest.json` updates.
- `bakePlayerAssets.mjs`: Player Holdout layer & socket exporter to `player-rig.json`.
- `bakeGearAssets.mjs`: Held gear & weapon sheet baker (`scale = 0.3333`).
- `pixelPost.mjs` & `pngCodec.mjs`: Outline sel-out post-processing and PNG/WebP encoding.
