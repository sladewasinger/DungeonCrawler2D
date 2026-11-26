# Client Textures & Sprite Manifest (`packages/client/src/render/textures`)

Procedural `48 px/tile` HD-pixel texture bakers and WebP sprite manifest preloader:

- `terrainTextures.ts`, `terrainTileDetails.ts`, `terrainTileMotifs.ts`: `32×32` Cainos-style 17-row terrain tilemaps and tangent-space normal maps.
- `propTextures.ts`, `poiPropTextures.ts`, and [`hd/`](./hd/README.md): HD trees, bushes, grass, boulders, flames, and POI props.
- `spriteManifest.ts`: Loads `public/assets/sprite-manifest.json` lossless `.webp` creature/gear/POI spritesheets with `scaleMode: "nearest"`.
- `pixelCanvas.ts`: Shared pixel-art Canvas2D helpers and `sel-out` silhouette stamps.
- **Subfolders**: [`hd/`](./hd/README.md), `biomes/` (biome terrain/prop atlases), and [`pois/`](./pois/README.md) (overworld POI & Safe-Room Hub textures).
