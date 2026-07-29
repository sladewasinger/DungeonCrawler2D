# World generation

The active generator plans one 96×96 district across a 3×3 group of runtime
chunks. One planned cell is still one world tile: this is shared planning, not
a logical-to-runtime scale pass. The finished surface is sliced into immutable
32×32 chunks for storage, networking, and rendering.

## Active pipeline

`World` calls `world/generate.ts`, which delegates ordinary chunks to
`world/generate/index.ts`. That coordinator runs these phases:

1. Partition the district into BSP rooms.
2. Stamp rooms and connect them to each other and all four district edges.
3. Add deliberate room height variants.
4. Project chunk-authored fixed features, descent structures, boss arenas, and
   landmarks into the shared district surface.
5. Repair connectivity and vertical extent once across the full district, then
   mark eligible void cells.
6. Slice the surface and convert topology into runtime terrain and feature
   planes one-to-one.

The generator is pure and deterministic for
`(worldSeed, floor, district coordinate, world features)`. Requesting any chunk
in a district produces the same nine byte-identical runtime chunks.

## Geometry controls

Developer-facing dimensions live in
`packages/engine/src/world/generate/worldGenerationTuning.json`, imported
through `tuning.ts`. Distances, widths, and radii are runtime-tile counts unless
their names explicitly say chunks, depth, frequency, threshold, or chance.
Changing one never changes `CHUNK_SIZE` or coordinate scale.

The tuning object groups related controls:

- `roomLayout`: BSP partition size, room inset, and district border margin.
- `roomFlavor`: district and area biases for generated room families.
- `corridors`: room, district-edge, and feature-link widths.
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
- Edge-anchor margins must leave room for the widest district connector.
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
