# Engine World (`packages/engine/src/world`)

Deterministic infinite `32×32` chunk generation and sliding terrain/prop collision.
- `types.ts`: Tile enums (`GroundKind`, `PropKind`), chunk dimensions (`CHUNK_SIZE = 32`, `TILE_PX = 16`), prop & light contracts.
- `biomeSampler.ts`: Seeded biome, hill elevation, trail, and river sampling around spawn and infinitely outward.
- `chunkGenerator.ts`: Pure deterministic generator producing tiles, props, and flickering fire/torch lights in `<3 ms`.
- `collision.ts`: Cached chunk lookup (`WorldChunkCache`) and continuous circle-vs-tile/stair/trunk sliding (`resolveMovement`).
