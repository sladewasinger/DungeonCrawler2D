# Engine World (`packages/engine/src/world`)

Owns world state (`World`, `WorldTerrain`), deterministic `32×32` chunk slicing,
terrain height/ramp queries, and finite-floor procedural generation.

## Tile & Terrain Planes

Defined in [core/types.ts](core/types.ts):

- `terrain`: authoritative `TERRAIN.Floor` (0) or `TERRAIN.Void` (1).
- `tiles`: base surface (`TILE.Floor`, `TILE.Bedrock`, `TILE.Void`).
- `features`: overlay code (`TILE.Floor` when empty, or `Stairs`, doors,
  `CraftingTable`, `Stash`, `ArenaGate`, `Water`, `Bridge`, `Tree`, `Bush`,
  `Boulder`).
- `SOLID_TILES`: occupancy values that block movement and projectiles outright
  (`CraftingTable`, `Stash`, `Void`, `Bedrock`, `ArenaGate`, `Water`, `Tree`,
  `Boulder`). Walkable overlays (`Bridge`, `Bush`, `Stairs`) remain passable.
- `height`: continuous tile elevation (`Float32Array`), ramped linearly on
  `TILE.Stairs` via `groundAt` / `stairHeightAt`.

## Open-World Finite-Floor Pipeline

`generate/finiteFloor.ts` delegates to `generate/forest/openWorldFloor.ts` to
build a deterministic finite floor (`512×512` default bounds) once per
`(worldSeed, floor, config)` and slices immutable `32×32` chunks on demand:

1. **Mandatory Features** — Spawn exterior, safe rooms, up/down stairways,
   mini-boss arenas, and boss arena (flattened onto `height = 0` pads).
2. **Grassy Hills & Sand (`openWorldTerrain.ts`)** — Carves a broad open
   interior inside a natural rock border, generates smooth `0.25`-step rolling
   hills (`-0.5` to `1.5`), and paints lush grass (`0`), sunlit meadow grass
   (`1`), and warm sand patches (`2`).
3. **Glades, Rivers & Bridges (`openWorldGlades.ts`, `forestRivers.ts`)** —
   Distributes open meadow glades for enemy/loot spawning, carves winding rivers
   with sandy riverbanks (`territory = 2`), and stamps walkable wooden bridges.
4. **Forest Props & Connectivity (`forestProps.ts`, `forestConnectivity.ts`)** —
   Scatters clustered `Tree` groves on grass, `Bush` cover, and `Boulder`
   outcrops, then runs a 0-1 BFS connectivity repair guaranteeing 100%
   reachability from spawn.
5. **Materialization** — Converts uncarved cells to `Bedrock`/`Void` boundaries
   and emits immutable `GeneratedFloor` buffers.
