# Fog of War (`packages/engine/src/world/fog`)

Pure chunk-indexed 8x8-tile Fog-of-War bitset state shared across server replication and client `[M]` Overworld Map rendering:

- `fogOfWar.ts`: `FOG_CELL_TILES = 8` (`16` cells per `32x32` chunk encoded in a `16`-bit chunk mask), `revealFogAroundPlayer` (`18`-tile base radius, `22`-tile elevated daytime radius), incremental `FogChunkDelta[]` tracking, and lossless compact base64 `encodeFogMask` / `decodeFogMask` serialization.
