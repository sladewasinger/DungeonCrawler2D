# Engine World (`packages/engine/src/world`)

Deterministic infinite `32×32` chunk generation and sliding terrain/prop collision.
- `types.ts`: Tile enums (`GroundKind`, `PropKind`), chunk dimensions (`CHUNK_SIZE = 32`, `TILE_PX = 16`), prop, POI (`PoiKind`, `ChunkPoi`), & light contracts.
- `biomeSampler.ts`: Seeded biome, hill elevation, trail, and river sampling around spawn and infinitely outward.
- `poiStamper.ts`: Deterministic `7×7` overworld POI stamper (`bandit-camp` and `ancient-ruins`) finding flat dry clearings outside chunk `(0, 0)` and stamping palisades, tents, ruin pillars, campfires, and torches.
- `chunkGenerator.ts`: Pure deterministic generator producing tiles, POI footprints, props, and flickering fire/torch lights in `<3 ms`.
- `collision.ts`: Bounded 96-chunk LRU cache (`WorldChunkCache`) and continuous circle-vs-tile/stair/trunk sliding (`resolveMovement`).
