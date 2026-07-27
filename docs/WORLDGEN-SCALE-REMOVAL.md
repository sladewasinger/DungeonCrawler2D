# World-generation scale removal

Status: planned design only. No generator, collision, renderer, or stair code is
changed by this document.

## Decision

The world should use 32×32 runtime chunks directly. The current blanket
`WORLD_GEOMETRY_SCALE = 2` expansion is not the intended way to make rooms,
features, and corridors readable. Remove that expansion instead of copying every
logical source cell into a 2×2 runtime block.

The replacement should preserve the generous layout by authoring those sizes in
runtime tiles:

- Increase room-to-room corridor widths.
- Increase room-to-border corridor widths.
- Increase avenue widths at district seams.
- Retune room/feature dimensions and margins where their current values were
  implicitly doubled.
- Author each stair as one runtime tile when this migration lands.

## Current code seams

- Runtime chunk size and terrain shape: `packages/engine/src/world/types.ts`.
- Logical 32×32 grid, scale constant, coordinate helpers, and 2×2 copy:
  `packages/engine/src/world/generate/scale.ts`.
- BSP rooms, corridor carving, height passes, and the final scale call:
  `packages/engine/src/world/generate/index.ts`.
- Room-to-room and room-to-border L-path corridors:
  `packages/engine/src/world/generate/corridors.ts` and `geometry.ts`.
- Cross-chunk anchors and district-boundary avenues:
  `packages/engine/src/world/generate/edges.ts` and `district.ts`.
- Fixed-feature, descent, and arena connectors:
  `feature-link.ts`, `descentLink.ts`, and `bossArenaLink.ts`.

`packages/engine/src/world/terrain.ts` contains the older base-sampling helpers;
the authoritative chunk path is `world.ts` → `world/generate.ts` →
`world/generate/index.ts`.

## Implementation order

1. Make the runtime chunk contract 32×32 and remove the blanket expansion pass.
2. Convert all generated coordinates and feature constants to direct runtime
   tile units; do not leave scattered `* 2` compensation behind.
3. Widen ordinary and avenue corridors in their generators, then retune BSP room
   bounds and feature footprints to retain the current sense of space.
4. Make the stair footprint one tile and re-derive stair height/connector rules
   from that footprint.
5. Re-baseline deterministic world fixtures and verify collision/render parity,
   cross-chunk connectivity, camera rotations, and all cardinal stair traversal.

This is an intentional world-coordinate/data-shape change. Existing generated
layouts and golden byte snapshots should be treated as regenerated artifacts, not
as compatibility data to preserve through another scaling shim.
