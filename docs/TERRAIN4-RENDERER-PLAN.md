# Terrain4 renderer plan

This is the design contract for the clean Phaser 4 renderer branch
`renderer/phaser4-heightmap`. It is deliberately separate from the legacy
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

The pure planner is Phaser-free. It emits typed floor and face quads; feature
art (stairs, doors, brazier, pets, entities) is a separate pass anchored to a
floor cap. This keeps future behaviours from leaking into terrain storage.

## Batching and rotation

The backend owns a small number of indexed batches grouped by atlas/material
and depth bucket. It must not allocate one display object per tile. Chunks are
cached by `(chunk, orientation, terrainRevision, featureRevision, lightRevision)`.
Edits invalidate the changed chunk and its seam neighbours; feature and light
changes invalidate only their owning/radius chunks.

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

## Generated atlas contract

All Terrain4 art uses the same eight logical columns, in this exact order:

| Column | Role | Meaning |
| ---: | --- | --- |
| 0 | `floor` | flat floor cap |
| 1 | `raised-floor` | cap with a height cue |
| 2 | `south-face` | finite Floor-to-Floor drop |
| 3 | `corner-face` | optional corner/side accent |
| 4 | `void` | flat black square with black border; no wall |
| 5 | `stairs` | traversable stair feature |
| 6 | `door` | door feature |
| 7 | `brazier` | light/decoration feature |

Each set has two rows (an alternate variant can be selected without changing
the frame IDs). The debug sheet labels every cell on the image itself:
`FLOOR`, `RAISED`, `FACE`, `CORNER`, `VOID`, `STAIRS`, `DOOR`, `BRAZIER`.
Biome art follows the same columns and rows, allowing the renderer to select a
biome by material key rather than by geometry branch. The current generated
art covers Maze, Open Halls, Ruins, Flooded Pools, Arena, and a separate
Pillar Forest sheet using this exact contract.

Assets:

- `packages/client/public/assets/terrain4/debug-atlas.png`
- `packages/client/public/assets/terrain4/terrain4-atlas.png` (shared biome sheet)
- `packages/client/public/assets/terrain4/pillar-forest-atlas.png`

Append `?terrain4Debug=1` to the game URL to enable a live geometry overlay:
`F` marks Floor caps, `V` marks flat Void caps, and `WF` marks a renderer-only
wall face generated between two Floor heights. `WF` is never a stored tile or
world value. This is intentionally an overlay in the first backend spike, so
labels remain readable while the atlas compositor is profiled. The generated
labeled debug atlas is also shown as a small in-game legend.

The shared sheet is intentionally compact; faces and void boundaries are
generated from the height map, so no per-direction wall atlas is needed.

## Delivery sequence

1. Keep the pure planner and headless fixtures authoritative for Floor/Void,
   height drops, seams, and all cardinal orientations.
2. Validate a Phaser 4 batch backend with one indexed/tinted quad, then add
   atlas frame selection and depth interleaving.
3. Add chunk streaming, dirty revisions, orientation double buffering, and the
   five-tick rotation fixture before switching scenes.
4. Port stairs/features/lighting and entity interleaving.
5. Run visual regression at all four orientations, switch dungeon/editor to
   Terrain4, and delete the legacy wall/autotile/page path only after parity.
