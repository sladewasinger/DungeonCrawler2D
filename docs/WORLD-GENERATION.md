# World generation

The active generator builds one 32×32 runtime chunk directly. There is no
logical-to-runtime scale pass: one generated cell is one world tile.

## Active pipeline

`World` calls `world/generate.ts`, which delegates ordinary chunks to
`world/generate/index.ts`. That coordinator runs these phases:

1. Partition the chunk into BSP rooms.
2. Stamp rooms and connect them to each other and all four chunk edges.
3. Add deliberate room height variants.
4. Stamp fixed features, descent structures, boss arenas, and landmarks.
5. Repair connectivity and vertical extent, then mark eligible void cells.
6. Convert topology into the runtime terrain and feature planes one-to-one.

The generator is pure and deterministic for
`(worldSeed, floor, chunk coordinate, world features)`.

## Geometry controls

Developer-facing dimensions live in
`packages/engine/src/world/generate/worldGenerationTuning.json`, imported
through `tuning.ts`. Distances, widths, and radii are runtime-tile counts unless
their names explicitly say chunks, depth, frequency, threshold, or chance.
Changing one never changes `CHUNK_SIZE` or coordinate scale.

The tuning object groups related controls:

- `roomLayout`: BSP partition size, room inset, and chunk border margin.
- `roomFlavor`: district and area biases for generated room families.
- `corridors`: room, edge, avenue, and feature-link widths.
- `roomDetails`: pillar and rubble spacing.
- `heightFeatures`: room/chasm elevation, frequency, bridges, and stair ramps.
- `landmarks`: arena, shrine, and tower footprints and elevations.
- `population`: generated room-loot frequency and count.
- `showcase`, `fixedFeatures`, `descentStructure`, and `bossArena`: authored
  set-piece dimensions.

Reserved personal, party, safe, and spawn rooms have their own dimensions in
`packages/engine/src/world/features/rooms/roomConfiguration/roomTuning.json`;
those are authored
room templates rather than procedural BSP generation.

Keep related constraints in mind when editing:

- A corridor must fit through the minimum room and partition spans.
- Edge-anchor margins must leave room for the widest avenue.
- Landmark and structure footprints plus clearance must fit inside 32×32.
- Chasm bridge width should remain odd so it has a centered tile.
- Boss-arena wall thickness must not exceed its radius.

`runtimeChunk.ts` owns only topology-to-runtime-plane conversion. It must not
grow geometry or duplicate cells.

## Removed generator

The former cave-noise/corridor sampler and its platform/terrace feature passes
were unused by active chunk generation. Their production modules and tests were
deleted. Server spawn and loot placement now derive from the active BSP rooms in
`populationRooms.ts`, so gameplay placement cannot drift from generated terrain.
