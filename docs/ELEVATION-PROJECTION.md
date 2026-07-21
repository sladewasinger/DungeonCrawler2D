# ELEVATION-PROJECTION CONTRACT — debug renderer

> Headline: adopt whole-scene elevation projection — every terrain surface bakes shifted
> screen-up by its height through the existing view seam while its own-cell face rows stay
> at their raw rows to fill the vacated gap; entities revert to absolute-z lift so grounded
> they land exactly on the shifted cap; picking/occlusion/shadow/halo re-anchor to the
> shifted ground surface. Supersedes the interim flat-projection entity commit fcb4530.
> Satisfies the two user rulings (ROADMAP item ELEVATION PROJECTION): (1) grounded entities
> stand ON their drawn tiles; (2) losing height moves you down-screen, slightly occluded.
> Produced by the opus design agent 2026-07-20; orchestrator-reviewed.

Notation: `TILE = SCREEN_TILE_PX`. `h(c)` = a cell's surface height (stair-ramp-aware
`groundAt` center for stair tiles, else `heightAt`). View space (post-`worldToView`,
pre-camera-rotation) has +y = screen-down. Rows below stated at orientation 0; the model is
orientation-general (§0).

---

## 0. The invariant that makes it orientation-safe

The height shift is a **scalar screen-Y offset of magnitude `h·TILE`, subtracted from the
baked/placed view-space Y AFTER `worldToView`/`worldToScreen`** — NOT a world-coordinate
offset applied before the rotation (a world-space `-h` on `worldY` would rotate to
screen-left at orientation 90). View-space Y is screen-down at every settled orientation,
so subtracting `h·TILE` is screen-UP at all four orientations for free — exactly how
entities already lift (`spriteLiftPx` subtracted after `worldToScreen`); terrain now does
the same in the per-chunk bake. Which world cell displays where, and which side is a face,
continue to flow from `viewWorld.ts`'s proxy + `worldToView`, untouched. Orientation-0
remains the identity except the vertical shift — the pixel-lock changes deliberately and
only by the shift (§6).

## 1. The one shift rule

**Surface rule (every cell's TOP/cap/floor/pit-floor/tread layer):** cell `(vx,vy)` draws
its surface — floor frame or chasm fill, chasm ghost, subtle-slope, stair tread + frame,
top-edge outlines, surface props — at view row `vy` shifted screen-up by `h(vx,vy)·TILE`.
Negative height (pit/chasm floor) shifts DOWN — a z-1 pit floor renders one tile
down-screen of its world row (ruling 2 realized directly).

**Face rule (fills the vacated gap):** a cell whose **screen-south** neighbor is lower by
`>= WALL_FACE_MIN_DROP (0.75)` draws a brick FACE BAND of `round(h - h_south)` rows in the
gap between this cell's shifted south edge and the south neighbor's shifted surface.
**Face rows draw at their RAW view rows (no shift).** For integer heights the band lands
exactly where `ownFaceRowAt`/`pitFaceRowAt` place brick TODAY — face computation, brick
selection, autotile mask, run closures, per-row shade reused verbatim; only cell
ownership/placement changes:

- A cell the face model today consumes entirely as face is physically walkable — under
  projection it MUST also emit a **shifted cap** so an entity standing there has a drawn
  surface. Cap (at `vy-h`) and face band (rows `vy-h+1 .. vy-h_south`) never overlap.
- The face band is **screen-space, not cell-space**: all `round(h-h_south)` rows draw
  regardless of how many physical cells the mass spans — fixes truncated isolated-tall
  cells; the "wall vertical-extent z+1" generator rule becomes a nicety, not a rendering
  correctness dependency.
- `ownFaceRowAt`/`pitFaceRowAt` are repurposed from "this cell renders as brick instead of
  its top" to "emit the face BAND for the drop on this cell's south edge"; `drawTile`/
  `drawGroundTile` stop early-returning face cells — always draw the shifted cap, then
  overlay the band.

**Stair/ramp tile:** surface (split rim-straddle fill + treads + nosing, per
R2-STAIRS-SPEC) shifts by the continuous ramp height at tile center (`(hi+lo)/2` for a
1-z stair): high edge flush with the shifted rim cap, low edge flush with the down-shifted
lower floor. R2's C0 continuity at both stair ends keeps the quad seamless. No separate
face band on the stair tile (it IS the transition surface). Per the user's stair-
directionality ruling, the two directions now genuinely differ per orientation:
descending-toward-camera stretches across the opened rows; descending-away compresses/
hides behind the high side's face.

### Worked examples (orientation 0)

- **A. z1 platform 2 rows deep (vy=10,11 h1; vy=9,12 h0):** caps at screen 9,10; face band
  1 row at screen 11 (= raw row 11, where ownFace draws today); entity at (x,11,z1) ->
  screen 10, ON its cap.
- **B. z1 platform 1x1:** cap at screen 9 + 1 face row at screen 10 — two screen rows from
  one physical row; height gets its visual space.
- **C. 2-tall wall (vy=10,11 h2; vy=12 h0):** caps screen 8,9; band 2 rows screen 10-11
  (= raw rows, where ownFace draws today); contiguous, no overlap.
- **D. z-1 pit (rim vy10 h0; floor vy11,12 h-1; rim vy13 h0):** floor renders down-shifted
  (screen 12,13); south rim at screen 13 covers the floor behind it — the R2 south-rim
  occlusion becomes AUTOMATIC. Entity in pit at (x,11,z-1) -> screen 12, on the floor.
  Jumping out moves the sprite up-and-out — mirror of the cliff drop.
- **E. rim-straddle stair (z0 -> z-1, vy=11, center h=-0.5):** tread quad at screen 11.5,
  high edge flush with the rim cap, low edge flush with the pit floor; split tints +
  nosing per R2.

## 2. Chunk baking

Generalize the existing per-row occluder-strip system to ALL height-shifted content:

- **Base sheet:** ONLY flat z0 ground and non-intruding pit-bottom floors (static, cheap).
- **Raised surfaces + face bands:** per-row strips with `overhangTiles` grown to cover cap
  lift (`stripOverhangTiles` already parameterizes strip height); far-above-ground content
  still bakes static per the existing occluderBand budget classifier (re-derived with lift
  added to distanceToGround).
- **Cross-chunk:** a cell's shifted cap is OWNED and drawn by its own chunk (absolute view
  positions; RT bounds get top margin). Row-scaled depth (`depthForOccluder`) — not RT
  insertion order — makes a southern chunk's cap cover a northern chunk's base sheet.
  THIS IS THE TOP RISK: caps must NOT stay in the flat base sheet or chunk seams flicker.
- **Rotation:** rebake path unchanged in shape; the shift computes inside drawTile from
  viewWorld, so fresh bakes at a new orientation shift correctly; `rebakeAllNow` still
  drains whole on the snap.
- **Streaming:** widen the desiredChunks view rect by maxHeight/maxDepth tiles (or rely on
  LOAD_MARGIN_CHUNKS=1 covering <= CHUNK_SIZE overhang) so tall structures at the screen
  top edge aren't culled while their caps are visible.

Rejected: per-height layer textures (N passes); whole-chunk shift-at-compose (shift is
per-tile-height).

## 3. Entity / depth / occlusion

- **Lift reverts to absolute z:** `spriteLiftPx(z) = z*TILE` (delete the interim flat
  convention). Grounded (`z = groundAt`) the sprite coincides with the shifted cap.
- **Depth stays row-keyed** (view-space feet row via `depthForViewEntity`; lift is the
  same-row tiebreak). Correct painter's ordering: ground footprint decides occlusion,
  bodies extend up.
- **`isOccludedByTerrainAhead` becomes exact:** occluded iff for some screen-south step k,
  `heightAt(ahead_k) - z >= k` (the cell's shifted body reaches the entity's row). The R2
  rim rule holds and SIMPLIFIES (the pit south rim now covers the pit-dweller in the bake
  itself); the silhouette ghost stays as the readability backstop.
- **Flagged nuance:** entity on a tall platform vs a shorter south wall — the height term
  bounds the ghost; a residual base-band artifact is accepted (mirrors today's static-pit
  sacrifice). Verify it never reads as the player vanishing.

## 4. Click-picking (game aim + editor paint)

A screen point may be a tall-far tile or a low-near tile. **Tallest-first shifted-footprint
search:** for H from maxHeight down, form the candidate view cell shifted DOWN by H, map
through `viewTileToWorld`, accept the first whose real `heightAt == H`. Falls back to the
flat H=0 cell (current behavior — flat-ground aim byte-identical).

- `input/pointer.ts` `cursorWorldTile`: insert the search between viewTile and viewToWorld.
- `scenes/editor/renderPanelPointer.ts` `hoveredCellAt`: identical; inspector already reads
  world-space and stays correct.
- **Editor paint-preview highlight moves to the SHIFTED position** `(vx, vy - h)` of the
  resolved cell — the highlight lands on the drawn cap.
- Known limitation: ground hidden BEHIND a wall can't be aimed at (the tall tile wins) —
  the correct 2.5D read; note in playtest.

## 5. Shadow / halo / wedge / decals

**GROUND-anchored things sit at `worldToScreen(x,y).y - groundAt(x,y)*TILE`; ENTITY-anchored
at `worldToScreen(x,y).y - z*TILE`.** Grounded, the two coincide.

- **Shadow (ground):** fed the shifted ground Y; `heightAboveGround = z - groundAt`
  (airborne) still scales it. Rewrite the flat-projection module doc.
- **Personal halo (ground):** add `groundHeight` to LightSource; place at the shifted
  ground beneath the player; torch/door lights use `groundAt(tile)` so a torch on a
  platform glows on the platform. Baked tile lighting is data — unchanged.
- **Melee wedge (entity):** anchors at the wielder's LIFTED feet (`- z*TILE`).
- **Blood/corpse decals (ground):** shifted ground of the hit position.
- **Nameplate/HP (entity):** follow the body; no extra change.

## 6. Migration (dependency order)

**Wave E1 — entity revert + anchors:** lift.ts (absolute z); playerVisual/monsterVisual/
torchEntityVisual/projectileEntityVisual body+chrome anchors; shadow.ts shifted ground;
meleeWedge + blood/corpse decal pools; lighting LightSource.groundHeight.

**Wave E2 — terrain surface shift (the core, atomic with E1's expectations):** drawTile
(no face-cell early return; surfaceLiftPx on cap layer); placeDebugTile/placeFillRect
accept optional screen-Y lift; drawGroundTile (floor/chasm/ghost/slope/tread/top-edges
shift by groundAt center; pit-face band raw); ownFace/pitFace repurposed to band emission;
drawWallTile cap shift; occluderBand/chunkVisual strip overhang + base-vs-strip classifier
+ row-scaled depth; streaming margin.

**Wave E3 — occlusion + picking + editor:** occlusion exact test; cursorWorldTile +
hoveredCellAt tallest-first; editor preview shift.

### Tests that re-baseline (deliberate)
faceScreenRelative (add cap-shift expectations; orientation-0 gallery changes BY THE SHIFT
— state it), topEdges pixel positions, ownFace/pitFace draw-site (pure fns stay green),
gallery reference images, lift/shadow/depthSort to absolute-z + shifted ground.

### Tests that must STAY GREEN (guard rails)
viewWorld, directionRemap, viewDepth (seam untouched); ALL engine physics/worldgen tests
(projection is client-only).

### Acceptance shots
1. THE cliff drop (seed 228182761 ~x20,y-39): jump off west edge z1->z0 — sprite+shadow
   move DOWN-screen, slightly occluded behind the south wall. Plus the anchor triangle
   (x13,y-46): sprite, shadow, halo all on the drawn cap.
2. z1 platform: grounded at every row, ON the cap, no float.
3. z-1 pit: player reads BELOW the south rim (occluded); stairs walk in/out flush.
4. Wall approach (~x5,y16 vs x9,y16): flush contact, slight occlusion; cliff edge as before.
5. Shots 2-4 at all four orientations after Q/X snap.
6. Editor: hover/paint a raised cap picks the cap cell; preview on the shifted cap.

## Risks (from the design pass, ranked)
1. Cross-chunk base-sheet draw order (mitigation: strips + row-scaled depth; caps NEVER in
   the flat base sheet).
2. Dynamic-strip blit count (re-derive the occluderBand budget with cap lift, or the
   keystroke-latency regression class returns).
3. Standing-on-own-cap depth split (caps = behind-entity surfaces; face bands = in-front
   occluders; conflating them hides players on platforms).
4. Tall-platform-vs-short-south-wall residual artifact (accepted, verify readability).
5. Stair quad continuity requires R2 stairs' engine contract green BEFORE E2 drives the app.
6. Picking: ground behind walls untargetable (accepted 2.5D trade).
7. Streaming cull of tall structures at the top screen edge (margin widening).
