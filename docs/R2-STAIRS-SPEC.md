# R2-STAIRS-SPEC — Compact Stairs (Wave R2)

Branch: `pivot/explicit-heights-reskin`. Status: implementable. This is the FIRST deliberate break of the Phase-1 byte-identical worldgen invariant — the world is *supposed* to move here.

All paths below are under `D:\repos\claude-test\DC2D-pivot\`. Every file cited was read and confirmed to exist on this branch.

---

## 1. Decision summary

**Austin's ruling:** a z0→z−1 pit stair must be **one tile long**, or at most a rim-straddling treatment ("half of the z0 tile and half of the z−1 tile") — never a multi-tile runway eating pit floor. His call wins; the 1-tile vs rim-straddle latitude is ours to recommend.

**Why stairs feel like ~3 tiles today (root cause, confirmed in code):** the generator already emits only **one** physical `TILE.Stairs` tile for a z0→z−1 pit (`world/generate/height.ts` `carveRamp`: `stepCount = max(1, ceil(1/MAX_STAIR_SLOPE 0.5)−1) = 1`). The perceived length is `world/stairs.ts` `RUN_PADDING = 1.5`, which projects a *virtual* ramp 1.5 tiles into the flanking pit floor (`stairs.test.ts` even asserts a "two-and-a-half-tile stair run" from one physical row). That padding exists solely to keep the per-tick surface delta under `STEP_UP`. Kill the `STEP_UP` dependency and the padding dies with it.

**The core cross-lane conflict, resolved.** The stacks lane claimed "just drop RUN_PADDING to 0" suffices because "slope 1 × RUN 0.6 tiles/tick = 0.06 z/tick." **That is an arithmetic error (0.6, not 0.06).** A 1.0-slope ramp changes surface height by `slope × MOVE_SPEED × TICK_DT = 1.0 × 8 × 0.05 = 0.4` per tick walking and `0.6` running — **both exceed `STEP_UP = 0.35`**, and they break the system in *two* independent places: the horizontal leading-corner gate (`collision.ts`) and the vertical grounded-descent gate (`physics.ts`). Dropping RUN_PADDING is necessary but **not sufficient**. The physics lane's **on-stair glide + boundary rim-gate** is required. We adopt it.

**Chosen shape (all three lanes converge here):**
- **The data model is exactly ONE stair tile** — a single `{walls:0, cap:null, stair:{dir}}` stack, single `height[i]`. "1-tile" and "rim-straddle" are **not two primitives**: the generator naturally places that one tread on the **rim-adjacent interior cell**, so its high (+dir) edge is flush with the z0 rim and its low (−dir) edge is flush with the z−1 pit floor. The single tile's span *is* the rim line — high half toward z0, low half toward z−1. That is simultaneously "one tile long" and "the rim straddle." It eats exactly one pit-floor cell (the minimum possible exit).
- **Rim-straddle is a RENDER treatment, not a second tile.** Recommended: render that single cell with a split base-fill (upper/rim half tinted at z0, lower/pit half tinted at z−1) plus a bright nosing line at the mid-seam. Reason: under the pit's darker lighting an in-pit tile darkens toward its low edge and swallows the climb cue; the straddle keeps the "climb up to here" signal on the bright rim side. This is a knob, not a fork — Austin can veto the split-fill for a plain uniform ramp tint (Open Question 2).

**Rejected:** a contextual `STEP_UP_STAIR` raise (Option B). To pass the run look-ahead it needs `STEP_UP_STAIR ≥ ~0.85`, at which point a body can snap up an over-projected look-ahead or snap down an 0.85 cliff adjacent to a stair; it is slope-dependent (retune per authored slope), brittle against knockback (`10 × 0.05 = 0.5`) and per-enemy speeds, and still needs gluing to fix run-down. **We add NO new movement constant.** `STEP_UP` stays `0.35`. The glide is speed/velocity-invariant, so it covers walk, run, knockback, and every enemy speed with zero per-entity tuning.

**Also simplified vs the physics lane's own proposal:** we DROP the `prevX/prevY` glide term. Its only purpose was to avoid a 1-tick airborne blip when exiting the top of a stair — but because the anchors are **flush by construction**, the existing unconditional snap-up in `resolveGroundedZ` (`terrain >= body.z → body.z = terrain`) already absorbs that final rise pop-free (traced tick-by-tick below). Dropping `prevX/prevY` also eliminates the "glide silently suppresses a legitimate side-drop / fall damage at the stair↔flat boundary" risk the physics lane flagged. Glide engages **iff currently grounded AND currently on a stair tile.**

---

## 2. Height / interpolation contract (ONE shared definition)

This is the single definition that physics (`groundAt` glue), stacks compile, `stairRampAt`, renderer z-lift, and shadow all build to. State it once, implement it once.

For a stair tile `T` with climb direction `d` (`d` points toward the strictly-higher neighbor; index convention `0=N,1=E,2=S,3=W`, shared by `stairs.ts` DIRS and `stacks` `StackDir`):

- `hi = heightAt(neighbor of T in +d)` — the higher flat/stair anchor
- `lo = heightAt(neighbor of T in −d)` — the lower flat/stair anchor

**Authoring invariant (deliberate stairs):** a deliberate generator/editor stair tile spans **exactly one z-unit** (`hi − lo = 1`); a straight run of `N` same-`d` deliberate stair tiles has flanking anchors differing by exactly `N`. Slope is therefore exactly `1.0` z per tile everywhere on a deliberate stair. (`cliffs.ts` graze-repair stairs may span `< 1` z — see §4; the physics is slope-agnostic, so those remain valid.)

**Continuous ground (what every body stands on)** at any position `(x,y)` inside `T`:

```
groundAt(x,y) = lo + (hi − lo) · f
```

where `f ∈ [0,1]` is the fractional distance from `T`'s low (−d) tile edge to its high (+d) tile edge, measured along axis `d`.
- `f = 0` at the −d tile boundary ⇒ `groundAt = lo` (flush with the low neighbor)
- `f = 1` at the +d tile boundary ⇒ `groundAt = hi` (flush with the high neighbor)

This is **exactly `stairRampAt()` with `RUN_PADDING = 0`** (interpolate `low`-anchor → `high`-anchor across the run's own physical tile extent only). For an N-tile run it is one straight linear segment of constant slope 1.0, so it is **C0 and C1 continuous across internal tile boundaries** and **C0-flush at both flat ends**. C0 continuity at every seam is the hard invariant the render lane depends on (sprite-lift and shadow pop iff a C0 height mismatch exists at a seam; a C1 slope kink is invisible to a blob shadow).

**Compiled scalar `height[i]` for a stair tile = the tile-CENTER value** `= lo + (hi−lo)·f_center`. For the canonical 1-z tile, `f_center = 0.5`, so `height[i] = (hi + lo)/2` (the midpoint). This scalar is used ONLY by (a) `entryClimbDir` sign detection, (b) the `?? heightAt(floor)` fallback in `groundAt` (never reached on a valid stair), (c) Wave-R2 "local ground" reads that don't sample a sub-tile position (shadow/occlusion). **Every moving body reads `groundAt` (the ramp), never raw `height[i]`.** Because `stairRampAt` reads the *neighbor* anchors (not the stair tile's own scalar), the ramp geometry is independent of the compiled scalar — the two agree at tile center by construction.

**Exact compile math (replaces the current even-split):**
- Generator `carveRampColumn` (`height.ts`): `stepCount = Math.round(Math.abs(toHeight − fromHeight))` (one tread per whole z). Tread `n = 1..stepCount` (counted from the `fromHeight` threshold): `height = fromHeight + Math.sign(delta) · (n − 0.5)`. Landing cell (one past the last tread) `= toHeight`. Worked: `0 → −1` ⇒ 1 tread at `−0.5`, landing `−1`. `0 → −2` ⇒ treads `−0.5, −1.5`, landing `−2`.
- Editor `compile.ts` `writeTreads`: tile `k = 1..stepCount` from the low anchor: `height = low + (high − low) · (k − 0.5)/stepCount`. For a valid run (`|high−low| = stepCount`) this = `low + (k−0.5)·sign`. Worked: `0 → 1` over 1 tile ⇒ `0.5`. `0 → 4` over 4 tiles ⇒ `0.5, 1.5, 2.5, 3.5`.

Note the current even-split formula `low + delta·n/(stepCount+1)` already yields the midpoint for `stepCount = 1`, so **single-tile cases are numerically unchanged**; only multi-tile runs shift (even-split → midpoints), and only there does raw `height[i]` move.

---

## 3. Physics changes (engine)

Shared `stepBody` is server-authoritative AND the client's prediction/replay AND enemy movement (combat/ai only emits `MoveInput`). Every change is a pure function of `(deterministic World, float position)` inside the one shared path — no new `BodyState` field, no randomness, so client prediction stays in lockstep.

### 3a. New WorldView seam
`packages/engine/src/world/types.ts` — add to `WorldView`:
```ts
/** Ramp height at a POSITION iff it sits on a TILE.Stairs tile, else null.
 *  Lets physics detect "on a stair" without importing TILE. */
stairHeightAt(x: number, y: number): number | null;
```
`packages/engine/src/world/world.ts` — implement on `World`: `stairHeightAt(x,y) { return stairRampAt(this, x, y); }` (World already exposes `tileAt`+`heightAt`, the `StairView` shape). Fan-out (mechanical, required): the two hand-built fakes — `entities/movement-elevation.test.ts` (its `WorldView` factory) and `world/stairs.test.ts` (`southEntryWorld`, the `twoWideSouthEntry`/`straightRun` worlds it drives bodies over) — must add `stairHeightAt`. Sweep `apps`/`game-server`/`client` for any other WorldView implementor before landing (the concrete server sim loop and client prediction both use `new World(...)`, so they inherit it; verify no bespoke WorldView object exists).

### 3b. Retire RUN_PADDING
`packages/engine/src/world/stairs.ts` — set `RUN_PADDING = 0` (or delete it and the `+ RUN_PADDING` terms in `stairRampAt` and `stairVisualAt`). `stairRampAt` then yields the self-contained, flush-at-both-edges ramp of §2. Keep `entryClimbDir`/`distanceFromTopEdge`/`buildRun` dir math unchanged. `DELTA_EPSILON` unchanged.

### 3c. On-stair glide (the walkability rule)
`packages/engine/src/entities/movement/index.ts` (`stepBody`) — after `moveHorizontal`, compute the glide flag and pass it in:
```ts
const terrain = world.groundAt(body.x, body.y);
const onStair = world.stairHeightAt(body.x, body.y) !== null;
return resolveVerticalMotion(body, terrain, dt, onStair);
```
`packages/engine/src/entities/movement/physics.ts` (`resolveVerticalMotion` gains an `onStair: boolean` param):
```ts
if (body.grounded && onStair) {
  body.z = terrain;   // == the ramp height; STEP_UP and gravity are never consulted on a stair
  body.zVel = 0;
  return {};          // stays grounded, no landing event
}
// else: existing tryLandOnLedge → resolveGroundedZ → applyGravityAndLand
```
`updateJumpState` runs FIRST in `stepBody`, so a buffered jump sets `grounded=false` before the glide is evaluated — jumps off a stair fire normally with `fallStart` at the current ramp z, and once airborne the glide predicate is gated off (normal arc physics apply; fall damage measured from the ramp point, not the pit floor). Airborne bodies falling ONTO a stair land via the unchanged `applyGravityAndLand`/`tryLandOnLedge` against the continuous `groundAt`, then glide on subsequent grounded ticks. `LANDING_TOLERANCE`/`AIRBORNE_LEDGE_CLEARANCE` untouched.

### 3d. Boundary rim-gate (the horizontal fix)
`packages/engine/src/entities/movement/collision.ts` — the leading-corner check samples `groundAt` at `nx + sign(dx)·BODY_RADIUS` = travel+radius (≈0.65 walk / 0.85 run) ahead, so on a 1.0 slope it reads 0.65–0.85 above the foot and returns `terrain − body.z > STEP_UP` ⇒ BLOCKED every mid-climb tick. Replace the `STEP_UP` height comparison with a **boundary-discontinuity test** when the move involves a stair. Thread the move axis `(dx,dy)` from `canMoveAxis` into `cornerBlocksMove` (keep its `isWalkable` + `blocked` checks intact — walls still block on stairs):
```ts
// after isWalkable/blocked checks:
const onStair = world.stairHeightAt(body.x, body.y) !== null
             || world.stairHeightAt(cx, cy) !== null;
if (body.grounded && onStair) return stairRimBlocks(world, body, dx, dy);
// else existing: grounded → terrain - body.z > STEP_UP; airborne → terrain > body.z + AIRBORNE_LEDGE_CLEARANCE
```
`stairRimBlocks`: if the foot tile and the destination-corner tile are the **same** tile ⇒ intra-tile move, never a discontinuity ⇒ allow. Otherwise sample the ground **immediately on each side of the tile boundary being crossed this tick**, along the move axis, on the body's centerline, and **block iff `(far-side ground − near-side ground) > STEP_UP`**. Rationale (the physics lane's own words, made precise): consecutive foot-center heights on the ramp differ by 0.4/0.6 per tick, so no foot-to-foot `STEP_UP` comparison can ever gate a stair — the gate must test the **boundary rim discontinuity**, not the climb. Along-axis stair travel and flat→stair entry at a flush edge give `rimStep ≈ 0` (allowed); stepping into a raised ramp FLANK (perpendicular side-entry from lower floor) gives the ramp's local height above the low floor, up to ~1 (blocked, correct — it's a real wall); walking OFF a ramp's side onto lower floor gives a negative rimStep (allowed — drops are free, then normal fall physics run because glide does not engage on the flat destination).

### 3e. Traced edge cases (all pop-free, no new constant)
- **Climb OUT of a −1 pit, running (0.6/tick):** entry tick — dest corner is the stair tread, rimStep at the pit↔stair boundary ≈ 0 (flush) ⇒ allowed; body enters, glide sets z to the ramp. Mid-climb ticks — glide sets z directly (rises 0.6/tick with no STEP_UP gate). Exit tick — foot still on stair, rimStep at stair↔rim boundary ≈ 0 ⇒ allowed; after the move the body is on flat rim (`onStair=false`), `resolveGroundedZ` sees `terrain(0) ≥ body.z(−0.3) → z=0`, grounded, **no airborne blip** (the flush anchor makes the unconditional snap-up absorb the residual rise).
- **Descend from the high end:** symmetric; first on-stair tick glides down, low-end exit lands flush on the pit floor. Zero flicker (matches the `stairs.test.ts` "descends… with no airborne flicker" expectation).
- **Walk off a partially-climbed ramp's side onto lower flanking floor:** rim-gate allows (negative rimStep); destination is flat so glide does NOT engage; `resolveGroundedZ` sees a drop > STEP_UP → freefall → `applyGravityAndLand` → real landing with fall height. Fall damage preserved (this is why we dropped `prevX/prevY`).
- **Knockback / enemies:** identical shared path; glide is velocity-invariant so a body shoved onto a stair rides it at any magnitude; shoved into a raised flank is stopped by the rim-gate; shoved off the side takes a normal drop. Zero AI or per-speed tuning.
- **CHASM_DEATH_Z (−1.5):** the −1 pit's low anchor (−1) is above it, so gliding to the pit floor does not trigger the server death ruling — a legitimately escapable pit. **Invariant:** a stair intended to be walkable in both directions must have `low anchor > CHASM_DEATH_Z`; the generator must never author such a stair descending into a true chasm (−2). The chasm ramp is the one place today that violates this — see §4 and Open Question 1. Server-side only; the client predicts movement and never asserts the kill.

Stale comment to fix while here: `collision.ts` `cornerBlocksMove`'s doc references "STAIR_RUN_LENGTH 2.5 / rise 2 over 2.5" — update to the 1-z/glide model.

---

## 4. Stacks / worldgen / editor changes

### 4a. Compile contract (`packages/engine/src/world/stacks/compile.ts`)
Replace `writeTreads`'s even-split `run.low + (run.delta · n)/(run.stepCount + 1)` with the **midpoint form** of §2: `low + (high − low)·(k − 0.5)/stepCount`. `walkRun`/`anchorHeight`/`resolveRun` and the explicit-`stair.height` fast path in `compileFirstPass` are unchanged. Update the `StackTile` doc in `stacks/types.ts` (lines 49–60) from "interpolates a linear run between flanking anchors" to the 1-z-per-tile contract. `CompiledField {tiles,height}` **shape is unchanged** — the physics/render lanes consume the same `Float32Array`; only the scalar convention (midpoint) and the ramp's own-tile extent change.

### 4b. Generator pit/chasm exits (`packages/engine/src/world/generate/height.ts`)
`carveRamp`: `stepCount = Math.round(Math.abs(toHeight − fromHeight))` (one tread per whole z). `carveRampColumn`: tread height `= fromHeight + Math.sign(delta)·(n − 0.5)` (§2). A −1 pit ⇒ 1 rim-straddling tread eating exactly one pit-floor cell; a dais +1 ⇒ 1 tread. `MAX_STAIR_SLOPE` is no longer the per-tread budget — **keep the `0.5` constant but repurpose it as `cliffs.ts`'s sub-tier auto-ramp step only** (do not delete; `cliffs.ts` imports it). `THRESHOLD_RAMP_MAX_WIDTH` unchanged. The chasm branch (`carveRamp(..., 0, CHASM_DEPTH −2)`) is the open design fork — see Open Question 1; pending Austin, leave it emitting 2 treads (`−0.5, −1.5`) but note its landing (−2) sits below CHASM_DEATH_Z.

### 4c. Cliffs safety net (`packages/engine/src/world/generate/cliffs.ts`)
Its `ramp()` only touches graze edges with `STEP_UP < |Δ| < WALL_RISE` (i.e. 0.35–1.0), pulling the higher cell one `MAX_STAIR_SLOPE (0.5)` step and tagging `Stairs` — a **sub-1-z repair stair**. That is legitimate (the physics glide is slope-agnostic; a 0.5-z stair glides and escapes fine), so **relax the strict "differ-by-exactly-1"**: deliberate stairs = exactly 1z; cliffs repairs = ≤1z; both are flush, sign-detectable, and glue-able. **Required coordination:** `ramp()`'s `alreadyRamped` guard calls `stairRampAt(view, nx+0.5, ny+0.5)`; with `RUN_PADDING = 0` that returns non-null only on an actual stair tile, shrinking the guard's reach, so an edge *adjacent* to a deliberate ramp may now be re-stamped. Re-verify `cliffs.ts` after RUN_PADDING removal and add a test that it does not fan a second redundant tread beside a deliberate ramp. `demoteOrphanedStairs` (sign-based, via `entryClimbDir`) stays as the final net.

### 4d. Pit-exit rule + escapability invariant (`packages/engine/src/world/generate/stairsInvariant.test.ts`)
The compact stair makes the inescapable-pit trap class (`docs/ROADMAP.md`, `austin-dungeon-prod-1` (37,7): chain `−1→−0.5→−1→0`) structurally impossible: a 1-tile rim-flush exit gives a monotone pit-floor→tread→rim path of exactly 2 cells — no multi-tile chain to orphan. Encode it:
- **REPLACE the flood rule in `canEscapeSunken`:** in its neighbor gate, if the destination tile is `TILE.Stairs` (`world.tileAt`), allow the step regardless of the `groundAt` delta (glue-to-surface), matching the new physics; keep everything else. `findPitRampLandings` structure stays. (Note: the 0.2-resolution flood already traverses a 1.0-slope ramp since `0.2 < STEP_UP`, so this is faithfulness + future-proofing, not a bug fix.)
- **RE-BASELINE "stair runs stay short":** the `ceil(2/0.5)−1 = 3` comment and `MAX_CLUSTER = 10` — a −2 chasm is now 2 treads (× up to `THRESHOLD_RAMP_MAX_WIDTH 2` wide) + cliffs slack; recompute the budget from the new output (expect ~4–6) and, per the stacks lane's recommendation, add an UPPER-bound assertion that a pit exit's stair footprint is `|depth|` treads (catches a future regression that widens an exit back into a runway).
- **STAYS GREEN unchanged:** "every Stairs tile has a real height delta across its climb axis" (sign-based `entryClimbDir`) and "a room's height-variant floor is reachable via its single staircase."

### 4e. Editor paint UX
`paintStairsAt` (`packages/client/src/scenes/editor/EditableWorld.ts`) is already correct — stamps `{walls:0, cap:null, stair:{dir}}` with no authored height; compile derives it. No new brush; the single flush tile IS the rim-straddle. Explicit N/E/S/W palette in `paintPanel/palette/stairsSection.ts` stays. Extend the inspector (`paintPanel/inspector.ts` `stackText`, currently `stairs dir=${stack.stair.dir}`) to show the resolved climb — e.g. `stairs dir=N ↑1z` when the ±dir anchors give a valid climb axis, and a red `stairs dir=N ✗ (no climb axis)` when they don't (both flat / wrong sign, i.e. `entryClimbDir` would be null after compile). `paintPanel/grid.ts`'s direction arrow can take an invalid-state tint. **Validation is a soft warn/badge, non-blocking** (matches today's permissive paint-anything model; `schema.ts` accepts any `{dir}`). Note: `EditableWorld.groundAt` returns raw `heightAt(floor)` (it does NOT ramp), so a stair previews as a flat midpoint plateau in the editor — a pre-existing preview-fidelity limitation, out of scope; the compiled/shipped output is the correct ramp.

### 4f. Migration is height-preserving (no existing map moves)
`fromHeightField.ts` `tileToStack` already writes every generated stair with an **explicit** `stair.height` (verbatim), and v1→v2 migration does the same, so old map JSONs (`docs/examples/user-broken-heights-z4-z6.json`) and any saved content migrate **byte-identically** through `compileFirstPass`'s explicit-height fast path. The compact semantics apply ONLY to fresh editor authoring (height-less `paintStairsAt`) and the rewritten generator. No existing map is auto-rewritten.

### 4g. Descent stairways are unaffected
`world/features/descent.ts` StairwayUp/Down are proximity-interact floor-to-floor portals (`STAIRWAY_HEIGHT 0.5` lives only on rim walls; floors are flush at height 0) and stamp **no `TILE.Stairs`**. Compact terrain stairs do not touch them. The 0.5 half-z there is not a walkable terrain ramp, so the 1-z rule does not apply.

---

## 5. Render / UX changes (client)

Terrain is BAKED into static per-chunk `RenderTexture`s (`chunkVisual.ts`); nothing tints or rotates per frame, so every stair visual is baked and must read WITHOUT motion (Austin's instant-legibility litmus). Sprite-lift (`lift.ts` `z*SCREEN_TILE_PX`), shadow (`shadow.ts`), nameplate/hpBar all key off continuous `z`/`groundAt`, so they stay pop-free **iff the engine keeps `groundAt` C0-continuous at both seams (§2)** — the render lane cannot fix a physics C0 gap.

### 5a. Tread art is the direction source of truth
The baked NS/EW frames (`generateDebugTileset.mjs` `drawStairLines`, exposed via `debugTileset.ts` `FRAME_STAIRS_NS/EW`) are uniform-spaced, uniform-black, and carry **no** direction cue; today the only direction signal is the translucent tread overlay's brightness gradient (`stairTread.ts`/`drawStairTread.ts`), and it is spread across a run-wide `t`. For a 1-tile stair there is no multi-tile run to spread over. Make the **vector overlay the source of truth**:
- `stairTread.ts`: raise `TREAD_COUNT`, make `bandBoundaries` geometric (risers packed tighter toward the SCREEN-high edge — receding-nosing perspective, so spacing alone says "up is that way"), add a full-brightness NOSING riser at the high edge, and drive brightness from **within-tile position**, not the run-wide `t` (with `RUN_PADDING=0`, `stairVisualAt` returns `t ≈ 0.5` for a lone tile, so the gradient must come from within-tile position, `LOCAL_GRADIENT` raised to dominate).
- `drawStairTread.ts`: raise riser contrast (`RISER_BASE_ALPHA`/`RISER_ALPHA_SPAN`), draw the nosing, and take `ViewOrientation`.
- Recommend **retiring the baked NS/EW stair frames** (overlay-only) to stop double-drawing and avoid the hand-synced `generateDebugTileset.mjs`↔`debugTileset.ts` frame-index hazard (a raster-order mismatch silently misassigns every frame after stairs). If kept, keep them as a faint base under the overlay.
- Rim-straddle split-fill: `drawGroundTile.ts` (`drawGroundTile`) — for the single in-pit stair tile, draw a split base-fill (z0-tint half + z−1-tint half + nosing at the mid/rim seam) instead of a uniform `heightTint(groundAt center)` fill. `stairVisualAt` with `RUN_PADDING=0` now returns non-null only on the physical tile, so tread art naturally confines to that one cell (Austin's "no runway") — the "perceived ramp = 1 tile" makes the old padding-visual concern moot.

### 5b. Rotation (4 orientations, the in-flight Wave R seam)
The correct contract already ships in `render/view/directionRemap.ts`: `stairTreadAxis(climbDir, orientation)` (treads perpendicular to SCREEN climb) and `screenSlotFor(worldDir, orientation)`. But the render path is **unwired**: `debugArt.ts` `pickStairFrame(direction)` and `stairTread.ts` `stacksVertically(direction)` consume WORLD direction, and `drawTile`/`buildChunkVisual` take **no orientation** (confirmed). Wire it:
- `debugArt.ts` `pickStairFrame` → `stairTreadAxis(compassDir, orientation)`; orient the dense-end/nosing via `screenSlotFor(highDir, orientation)`.
- Thread `ViewOrientation` through `drawTile.ts` → `chunkVisual.ts` `buildChunkVisual`/`drawGroundTile`/`drawStairTreads`, and **re-bake chunks at each settled 90° orientation**, swapping textures at the rotation-tween crossfade midpoint (the same seam wall faces use — `rotationTween.ts`; do not re-bake mid-tween or it hitches). A 1-tile stair is strictly simpler here than a multi-tile run: it can never split across a chunk boundary.

### 5c. Occlusion + shadow interplay (Wave R2 fixes a & b — keep compatible, do not fully design)
- **Occlusion (a):** the stair tile is walkable, never a solid occluder; the occluder is the pit RIM face south of the climber (`render/entities/occlusion.ts`). As z rises −1→0 on the ramp the cyan ghost releases continuously and clears at the crest — a SHORTER occluded window than today's long ramp, needing no retune. Route any "terrain higher than an entity between it and the camera" test through `groundAt` (the single ramp-surface source), not raw `height[i]`, or a pit-stair shadow floats.
- **Shadow (b):** `shadow.ts` `updateShadowPosition` places the blob at a ground-plane screen position with a height-scale falloff; the caller (`playerVisual.ts`) must compute that ground Y from `spriteLiftPx(groundAt(feet))` so the blob sits on the SLOPED surface at the feet at every z. On the 1-tile stair `groundAt` is continuous, so the blob tracks smoothly; grounded ⇒ `heightAboveGround = 0` ⇒ full-size blob on the ramp. A blob shadow is immune to the C1 slope kink; only a C0 mismatch pops it.

### 5d. Gallery / manual-verify cases (all 4 orientations)
1. z0→z−1 pit exit: one rim-straddling tread, treads perpendicular to screen-climb, nosing on the bright rim side; walk in and out at walk + run without stutter.
2. Same at orientations 90/180/270 — tread axis and dense-end flip per `stairTreadAxis`/`screenSlotFor`; re-bake is crossfade-clean.
3. Dais +1 (single tread up).
4. −2 chasm ramp (2 treads) — pending Open Question 1.
5. Shadow tracks the slope; nameplate/hpBar rise with the body; occlusion ghost flashes briefly and clears at the crest.

---

## 6. Test plan (re-baseline vs REPLACE)

**RE-BASELINE (world moved, mechanism still valid — change expected values, note "the world is supposed to move here"):**
- `world/stairs.test.ts` "ramps linearly across the complete two-and-a-half-tile stair run" → the self-contained 1-tile flush ramp (flat `lo` below the −d edge, `hi` above the +d edge, full `lo→hi` only within the physical tile).
- `world/stairs.test.ts` multi-tile "chasm-gradient" `straightRun` fixtures → 1-z-per-tile geometry; the walk-down/climb assertions stay green under the glide.
- `world/stairVisual.test.ts` tread-extent / `t` expectations → `RUN_PADDING = 0` confines the visual to the physical tile.
- `world/generate/stairsInvariant.test.ts` "stair runs stay short" `MAX_CLUSTER` budget + the `ceil(2/0.5)−1=3` comment → new compact counts (chasm 2, pit exit 1).

**REPLACE (stronger semantics):**
- `world/stacks/compile.test.ts` "a height-less stair interpolates a single tread to the midpoint" (0→2, 1 tile) and "a height-less multi-tile run divides the full rise into equal-slope treads" (0→4, 3 tiles) → new cases: 1 tile between 0 and 1 → `0.5`; 4 tiles over 0→4 → `0.5,1.5,2.5,3.5`; plus an invalid-authoring case (anchors differ by ≠ tile count → surfaced, not silently interpolated).
- `world/generate/stairsInvariant.test.ts` "a pit's deepest floor can walk back OUT" → `canEscapeSunken` neighbor gate treats `TILE.Stairs` destinations as glue-to-surface; add the footprint upper-bound assertion.

**STAY GREEN, guard against accidental breakage (if these move, a wrong file was touched):**
- `world/generate/stacksRoundtrip.test.ts` — **critical nuance:** it asserts `compile ∘ fromHeightField == generate` and calls itself "byte-identical to today's generated height field." It **stays green** because both sides re-derive from the *same* new generator (the round-trip MECHANISM is unchanged and `fromHeightField` carries explicit heights). The genuine "first deliberate break of the byte-identical invariant" is that the generator OUTPUT changes versus **pre-R2 saved/golden values**, NOT that this round-trip changes. Do not let a re-baseliner chase a non-existent regression here; if `stacksRoundtrip` actually moves, the explicit-height fast path was wrongly touched.
- `world/stacks/compile.test.ts` explicit-`stair.height` override, feature/wall/floor cases; `stacks/migrate.test.ts`; `game-server` map-migration; editor `EditableWorld.test.ts` (all exercise the z4/z6 fixture via height-preserving migration).
- `world/generate/stairsInvariant.test.ts` "every Stairs tile has a real height delta" and "reachable via its single staircase."

**NEW required tests:** boundary rim-gate sampling at all 4 `dir` values (a wrong epsilon sign wrongly blocks along-axis entry or wrongly admits flank entry); glide keeps grounded climbing a 1-z stair at walk AND run (no airborne tick); walk-off-side takes a real fall (glide does not suppress it); `cliffs.ts` does not fan a redundant tread beside a deliberate ramp after `RUN_PADDING=0`; a generator invariant that no walkable-both-ways stair's low anchor ≤ `CHASM_DEATH_Z`.

**Golden snapshot:** if a 25-seed golden height-field snapshot exists outside `packages/engine/src` (not found in scope — likely an app/fixtures dir), REGENERATE it as a net and add an assertion that the diff is confined to stair cells + their ramp neighbors (non-stair terrain stays byte-identical), so a worldgen regression can't hide inside the intended stair delta.

---

## 7. Build order (dependency-ordered lanes for the orchestrator)

**Wave R2.1 — ENGINE CONTRACT (one atomic PR; it changes a shared `WorldView` interface and the shared `stepBody`, so physics + stacks must land together or the interface is half-wired).** Sub-tasks, all against §2/§3/§4a–d:
- (a) `types.ts` add `stairHeightAt`; `world.ts` implement; update both engine test fakes.
- (b) `stairs.ts` `RUN_PADDING = 0`.
- (c) `compile.ts` midpoint formula; `stacks/types.ts` doc.
- (d) `height.ts` `stepCount = round(|Δ|)` + midpoint treads; `cliffs.ts` re-verify + guard test.
- (e) `physics.ts` glide + `index.ts` `onStair`; `collision.ts` rim-gate.
- (f) re-baseline/replace the engine tests in §6.
This PR is self-contained, fully unit-tested, and deployable (physics + worldgen correct) even before the renderer is touched — the stair merely renders with the current world-direction art.

**Wave R2.2 — RENDER (depends on R2.1's `groundAt` continuity + `stairVisualAt` tile-confinement). Parallelizable internally:**
- (a) tread art + split-fill + nosing (`stairTread.ts`, `drawStairTread.ts`, `drawGroundTile.ts`, optionally retire `generateDebugTileset.mjs` NS/EW frames + `debugTileset.ts`).
- (b) rotation wiring (`debugArt.ts` → `stairTreadAxis`/`screenSlotFor`; thread `ViewOrientation` through `drawTile.ts`/`chunkVisual.ts`; re-bake at crossfade midpoint).
- (c) shadow lift (`playerVisual.ts` + `shadow.ts`) and occlusion routing through `groundAt` — coordinate with the other Wave R2 lanes (occlusion a / shadow b) since both read local ground.

**Wave R2.3 — EDITOR (depends on R2.1; small, can run alongside R2.2):** inspector badge (`paintPanel/inspector.ts`), grid arrow tint (`paintPanel/grid.ts`). `paintStairsAt` needs no change.

Gate: R2.1 green before R2.2/R2.3 start driving the app.

---

## 8. Open questions for Austin

1. **Chasm (−2) exit — descending stair, or sheer edge?** Today the generator carves a walkable ramp all the way to `CHASM_DEPTH −2`, whose landing sits *below* `CHASM_DEATH_Z −1.5` — so a walker gliding down it dies partway (an effective death-slide), which contradicts "chasms are knockback death-pits crossed by the one bridge." Recommendation: chasms get **NO descending terrain-stair** (sheer edge, crossed by the existing bridge, fall-in = the knockback-death ruling), which makes the invariant "every walkable-both-ways stair's low anchor > CHASM_DEATH_Z" clean and cheap to enforce. Compact stairs then serve only survivable pits/daises. Your call — this is the only place multi-z / death-z interact.

2. **Rim-straddle look — split-fill, or plain ramp tint?** The data is one stair tile either way. You offered "half z0 / half z−1"; we implement that as a RENDER treatment on the single rim-adjacent cell (upper half tinted z0, lower half z−1, bright nosing at the seam) so the climb cue survives the pit's darker lighting. Want that split-straddle look, or a plain uniform ramp tint on the single tile?