# Engine World (`packages/engine/src/world`)

Deterministic infinite `32×32` chunk generation and sliding terrain/prop collision.
- `types.ts`: Tile enums (`GroundKind` `0..16`, `PropKind`), chunk dimensions (`CHUNK_SIZE = 32`, `TILE_PX = 16`), biome & danger contracts (`BiomeKind`, `DangerTier`), prop, POI (`PoiKind`, `ChunkPoi`), & light contracts.
- `biomes/macroBiome.ts` & `biomes/biomeProps.ts`: Low-frequency 5-biome macro sampling (`verdant-forest`, `autumn-woods`, `misty-bog`, `craggy-highlands`, `cursed-ruinlands`), distance/biome `DangerTier` scaling (`1..4`), and biome-specific prop scattering.
- `biomeSampler.ts`: Seeded biome, hill elevation, trail, and river sampling around spawn (`r < 28` always Verdant Forest) and infinitely outward.
- `poiStamper.ts` & `poiLayouts.ts`: Sparse (`2×2` macro-cell) deterministic overworld POI stamper with varied non-square layouts (`camp-outpost`, `camp-l-shape`, `camp-courtyard`, `camp-warband`, `ruins-shrine`, `ruins-colonnade`, `ruins-sanctum`), scaled guard rosters, sealed diagonal palisades, flush tents, ruin pillars, campfires, and torches.
- `chunkGenerator.ts`: Pure deterministic generator producing tiles, POI footprints, props, and flickering fire/torch lights in `<3 ms`.
- `propFootprints.ts`: Bottom-anchored ground footprint offsets, rounded-box structure specs (`Palisade`, `Workbench`, `Bed`, `WoodChest`, POI chests), capsule tents, `GroundColliderShape`, and exact segment/box `closestObstacleCorePoint` projection shared across physics, pathfinding, and debug rendering.
- `collision.ts`: Bounded 96-chunk LRU cache (`WorldChunkCache`), unified `BlockingObstacle` queries (circular props, rounded-box structures, capsule tents, and POI chests), sub-stepped 8-way oriented foot-capsule sliding collision & stationary turn pushout (`resolveMovement`), and deep-water/shallow-water swim detection (`inWater`, `inDeepWater`) with configurable swim/wade movement scaling.
- `jumpPhysics.ts`: Shared vertical jump/fall arc integration (`stepJumpArc`), foot-tile bounds traversal (`forEachFootTile`), and airborne cliff/stair elevation resolution (`resolveDestElevation`).
