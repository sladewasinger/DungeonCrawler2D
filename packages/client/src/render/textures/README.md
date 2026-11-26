# Client Textures & Sprite Manifest (`packages/client/src/render/textures`)

Procedural `48 px/tile` HD-pixel texture bakers and WebP sprite manifest preloader:

- `terrainTextures.ts`, `terrainTileDetails.ts`, `terrainTileMotifs.ts`: `32×32` Cainos-style 17-row terrain tilemaps and tangent-space normal maps.
- `propTextures.ts`, `hdFoliageTextures.ts`, `hdPropTextures.ts`, `hdFireTextures.ts`, `poiPropTextures.ts`: HD trees, bushes, grass, boulders, flames, and POI props.
- `spriteManifest.ts`: Loads `public/assets/sprite-manifest.json` lossless `.webp` creature/gear/POI spritesheets with `scaleMode: "nearest"`.
- `pixelCanvas.ts`: Shared pixel-art Canvas2D helpers and `sel-out` silhouette stamps.
- **Subfolders**: `biomes/` (biome terrain/prop atlases) and `pois/` (frontier POI textures).
