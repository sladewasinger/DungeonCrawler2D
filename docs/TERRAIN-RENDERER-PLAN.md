# Terrain renderer plan

This is the design contract for the current terrain renderer. It is
deliberately separate from the legacy
autotile/page/strip renderer so that the two paths can be compared while the
new path is brought to parity.

## Data and geometry

The world is a height map: a cell is either `Floor` with a finite height or
`Void` with no height. `Void` is a flat black tile. It never emits a projected
wall, a rim, a face, or a camera-facing purple surface. A south face can only
be generated between two adjacent `Floor` cells when the source cell is
higher than the screen-south neighbor. The planner transforms screen-south
through the four cardinal view orientations, so the rule is identical at
0/90/180/270 degrees.

The pure planner is Phaser-free. It emits typed floor, face, cliff-edge,
ambient-occlusion, atlas-feature, and sprite-prop quads; feature art (stairs, doors, brazier, pets, entities) is a
separate pass anchored to a floor cap. Crafting tables and stashes retain their
existing atlas sprites through the prop plane rather than being approximated by
brazier art. This keeps future behaviours from leaking into terrain storage.

## Batching and rotation

The backend owns indexed Phaser `Mesh2D` batches grouped by atlas, painter
phase, and the exact view-row depth used by entity sprites. This is the
interleaving contract: a finite `WF` face can sit in front of a north entity
and behind a south entity without a per-tile display object. Chunks are cached
by `(chunk, orientation, terrainRevision)` and a revision change prunes stale
plans; edits invalidate the changed chunk and its seam neighbours.

Cardinal orientation roots are double-buffered. The adjacent orientation is
prewarmed while the current view is displayed; rotation keeps the old root
visible until the new root is complete, then swaps atomically. There must be no
blank frame, synchronous full-world rebuild, or flash between orientations.

### Rotation acceptance gate

With a representative streamed dungeon (including entities and chunk seams),
the time from a rotation input to the new orientation becoming visible must be
under **250 ms (five 50 ms simulation ticks)**. A rotation may reuse the
prewarmed cache; it must never clear the currently visible root first. The
performance fixture records input time, first complete new-orientation frame,
and dropped/blank frames.

## Visual regression gate

Terrain must have a deterministic visual fixture before the renderer is
considered release-ready. The fixture is a small editor-style scene, not a
random dungeon capture, so every important rule is visible in one image:

- flat Floor, raised Floor at 0.5/1/2/3 heights, and adjacent height drops
  that produce `WF` faces;
- Void surrounded by Floor, including every cardinal edge (no Void wall or
  cap lift);
- stairs in all four climb directions, a stair beside a ledge, and door/
  brazier feature anchors;
- chunk seams/aprons and entity-depth interleaving representatives;
- representative patches for Maze, Open Halls, Ruins, Pillars, Pools, and
  Arena atlas sets.

The fixture is rendered at a fixed canvas size, device pixel ratio, seed,
orientation, and disabled antialiasing. The test captures the complete RGBA
canvas and compares it pixel-for-pixel with a committed golden PNG. It must
run at all four cardinal orientations; the minimum required gate is one exact
visual comparison, with the intended suite using one golden per orientation
and biome-material pass. A mismatch writes a diff image and a machine-readable
list of changed pixels for review.

The current renderer's planner, wall-segmentation, atlas, and chunk-cache
tests provide the deterministic headless contract; the browser gallery
harness described below remains the manual visual pass. Golden files, when
the renderer is promoted toward a release, live beside the Terrain visual tests under
`packages/client/src/render/terrain/__golden__/`. The test must never
auto-update them. Any divergence, including a one-pixel change, fails CI and
must be shown to Austin for approval before updating the golden image. An
approved update is a separate commit containing both the reviewed diff and the
new golden PNG; renderer changes may not hide regressions by rewriting goldens
in the same step.

The gate records the renderer/atlas contract version and Phaser major version
in fixture metadata, making an intentional rendering-engine upgrade an
explicit review event rather than an unexplained mass pixel change.

## Generated atlas contract

All Terrain art uses the same nine atlas columns. Column zero is reserved for
row labels in the debug sheet; the remaining columns are stable role slots.

| Row | Column | Role | Meaning |
| ---: | ---: | --- | --- |
| 0 | 1 | `floor` | flat floor cap |
| 0 | 2 | `raised-floor` | cap with a height cue |
| 0 | 3 | `bedrock` | dark structural cap; shares the authored goblin source slot |
| 1 | 1 | `south-face` | finite Floor-to-Floor drop |
| 2 | 1 | `stairs` | traversable stair feature |
| 2 | 2 | `stair-wall-face` | stair riser wall face |
| 3 | 1 | `door` | door feature |
| 3 | 2 | `brazier` | light/decoration feature |
| 4 | 1 | `void` | flat black square with black border; no wall |

Each set has one row. The debug sheet labels every cell on the image itself:
`FLOOR`, `RAISED`, `FACE`, `STAIRS`, `STAIR WALL`, `DOOR`, `BRAZIER`, and
`VOID`.
The current runtime uses an identical, separately named copy of that one-row
sheet for every biome, including Pillars.

Runtime assets:

- `packages/client/public/assets/terrain/debug-atlas.png`
- `packages/client/public/assets/terrain/shared-atlas.png`

Append `?terrain4Debug=1` to the game URL to select the generated labeled debug
sprites directly. The labels are baked into those sprites (`FLOOR`, `VOID`,
`WF`, and feature names); Terrain does not create a runtime text object per
tile or a separate debug legend. `WF` remains renderer-only and is never a
stored tile or world value.

For a deterministic, server-free browser pass, use
`?scene=gallery&terrain=1&terrain4Debug=1`. The existing GalleryScene then
drives the same Terrain renderer against its fixed generated world, which is
useful for screenshots and rotation/biome checks without connecting a player.

The shared sheet is intentionally compact; faces and void boundaries are
generated from the height map, so no per-direction wall atlas is needed.

The authored territory pairs occupy row 0/1 columns 3, 4, and 5. Column 3 is
therefore a deliberate source-slot alias: the semantic `bedrock` role uses
its dark structural art for caps, while `territory-goblin-floor` uses the same
bitmap cell for goblin territory floors. The renderer keeps those semantic
roles separate for material ordering and classification; the compact atlas
does not claim a fourth bitmap pair.
Cliff edges do not select atlas tiles; they receive a cheap procedural white
Graphics rim overlay in both debug and normal modes. Height-map planning
retains its cliff-edge geometry for that overlay and the non-atlas fallback,
while ambient occlusion remains an independent height-derived pass. Void
neighbors never create a cliff edge or AO mask. Low Floors beside higher Floors
receive three nested screen-space contact bands plus diagonal corner patches,
grouped by depth row so AO remains below entities while retaining the old
`contactShade` strength dial.

## Delivery sequence

1. Keep the pure planner and headless fixtures authoritative for Floor/Void,
   height drops, seams, and all cardinal orientations.
2. Validate a Phaser batch backend with one indexed/tinted quad, then add
   atlas frame selection and depth interleaving.
3. Add chunk streaming, dirty revisions, orientation double buffering, and the
   five-tick rotation fixture before switching scenes.
4. Add dedicated furniture art and a terrain light-tint pass. The existing
   `LightingSystem` remains authoritative for the player ground-light effect,
   torch halos, and dynamic accent lights; Terrain must not replace that pass.
   Stairs, doors, and generic interactables already use the feature plane.
5. Run visual regression at all four orientations, switch dungeon/editor to
   Terrain, and delete the legacy wall/autotile/page path only after parity.
