# Engine World (`packages/engine/src/world`)

Deterministic infinite `32×32` chunk generation and sliding terrain/prop collision.
- `types.ts`: Spatial constants (`CHUNK_SIZE = 32`, `TILE_PX = 16`) and world contracts (`GroundKind` `0..16`, `PropKind`, `BiomeKind`, `DangerTier`, `PoiKind`, `ChunkPoi`, re-exported from `@dc2d/contracts`).
- `biomes/` & `pois/` (`poiCatalog.ts`, `macroBiome.ts`, `biomeProps.ts`): Low-frequency (~3.5× macro scale) 5-biome sampling (`verdant-forest`, `autumn-woods`, `misty-bog`, `craggy-highlands` at `r >= 1000`, `cursed-ruinlands` at `r >= 2000`), `TIER_DISTANCES` (`1000 / 2000 / 3500 / 6000` tiles), `POI_CATALOG` (`20` POIs), and biome/distance-gated prop scattering (iron veins past `900` tiles).
- `biomeSampler.ts`: Seeded biome, hill elevation, trail, and river sampling around the sheltered starter valley (`r < 220` Verdant Forest) and infinitely outward.
- `chunkGenerator.ts` & `poiStamper.ts`: Single-pass `ChunkTileGrid` pre-sampling + `33×33` 2D prefix sums for zero redundant noise evaluation during chunk generation and POI placement.
- `spatialHashGrid.ts`: Zero-string-allocation `SpatialHashGrid` (`cellSize = 16`) for `O(nearby)` spatial queries.
- `collision.ts`: Configurable chunk LRU cache (`WorldChunkCache`, default `256` chunks, server `Math.max(512, maxClients * 16)`), unified `BlockingObstacle` queries, sub-stepped 8-way oriented foot-capsule sliding collision & stationary turn pushout (`resolveMovement`), and deep-water/shallow-water swim detection (`inWater`, `inDeepWater`).
- `jumpPhysics.ts`: Shared vertical jump/fall arc integration (`stepJumpArc`), foot-tile bounds traversal (`forEachFootTile`), and airborne cliff/stair elevation resolution (`resolveDestElevation`).
