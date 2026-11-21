# Finite below-zero elevation contract

- Task: `2026-08-03-finite-below-zero-elevation`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/generate/finiteFloorElevation.ts; packages/engine/src/world/generate/finiteFloor.ts; packages/engine/src/world/generate/config/floorGenerationConfig.ts; packages/engine/src/world/generate/finiteFloorTypes.ts; focused finite elevation/config tests; packages/game-server/src/sim/combat/chasmDeath.test.ts; workflow records`
- Preserve: `All other production and test paths; finite topology/connectivity, authored feature elevations, movement limits, renderer semantics, editor/admin surfaces, and unrelated dirty changes.`

## Goal

Restore the finite-dungeon product contract that ordinary playable terrain can occupy coherent below-zero elevations, including z=-2, without being classified as lethal Void. Generated elevation changes must remain connected through legal supported transitions, deterministic, bounded by normalized configuration, and visible in generation identity/fingerprints.

## Plan

- [x] Define and normalize an explicit finite elevation range that includes below-zero levels without changing existing height scale or authored feature semantics.
- [x] Assign coherent region/route elevations and materialize only legal traversable transitions while retaining mandatory connectivity and spawn safety.
- [x] Prove representative deterministic floors contain playable below-zero terrain, distinguish it from Void in server chasm handling, and retain reconstruction/fingerprint determinism.
- [x] Run focused elevation/topology/chasm shards, engine and game-server typechecks, and `npm run lint:working-tree`.

## Decisions

- The semantic-triage reproduction is a product defect, not a stale seed: current cached void-disabled finite floors for seeds `1288112906`, `2456994514`, and `74621` contain playable height ranges of `0..3` and no z=-2 floor cells.
- Current `finiteFloorElevation.ts` stamps only nonnegative stair and platform heights; selecting another seed cannot restore the explicit below-zero contract.
- Do not satisfy acceptance by mutating one test cell, loosening the chasm assertion, treating negative height as Void, or changing global height scale.
- Parent approved and assigned implementation to the persistent Sol coder.
- `finiteFloor.ts` is authorized solely as the call site that passes normalized
  elevation configuration into the existing transition boundary.
- Ordinary Corridor, Room, and Transition surfaces now descend in deterministic eight-cell graph-distance bands from authored surfaces. The configured step is capped at one z-unit for ordinary edges, matching the existing generated-jump legality model without changing movement constants.
- Elevation runs after final route and ordinary-gap repairs so every final carved cell participates in the same coherent distance field. Authored feature semantics remain anchored and their existing stair/platform ramps are restored afterward at their established heights.
- `minimumElevation` normalizes to `-4..0`; `maximumElevation` honestly exposes only the movement-safe ordinary ceilings `-1..0`, with defaults `-2` and `0`. Inverted input lowers the minimum to the accepted ceiling. Positive authored heights remain outside the ordinary-terrain profile by design.
- Generator version remains `6` to preserve existing XY topology seed compatibility. The new normalized fields change `configurationFingerprint`, and the generated height plane changes the floor fingerprint, making the contract identity-visible without moving existing topology fixtures.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/finiteFloorElevation.ts`
  - `packages/engine/src/world/generate/finiteFloor.ts`
  - `packages/engine/src/world/generate/finiteFloorTypes.ts`
  - `packages/engine/src/world/generate/config/floorGenerationConfig.ts`
  - `packages/engine/src/world/generate/config/floorGenerationConfig.test.ts`
  - `packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts`
  - `agent-workflow/04_finalize/2026-08-03-finite-below-zero-elevation.md`
- Validation:
  - `npx vitest run packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/game-server/src/sim/combat/chasmDeath.test.ts --maxWorkers=1 --reporter=verbose` — 4 files / 18 tests passed in 23.37s.
  - The elevation shard proves symmetric coherent bands, a real seed `74621` ordinary z=-2 surface, configured `minimumElevation: -1` clamping, movement legality, repeat height equality, and configuration/floor fingerprint distinction.
  - The unchanged chasm shard proves explicit Void remains lethal while ordinary finite Floor terrain at z=-2 is walkable and nonlethal.
  - `npm run typecheck --workspace=@dc2d/engine` — passed.
  - `npm run typecheck --workspace=@dc2d/game-server` — passed.
  - `npm run lint:working-tree` — passed; only documented baseline folder-size notices remain.
  - Review correction: `npx vitest run packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts --maxWorkers=1 --reporter=verbose` — 2 files / 9 tests passed in 5.47s.
  - Review correction: the full four-file card gate passed 19 tests in 9.73s; engine and game-server typechecks passed.
  - Review correction final: the elevation shard passed 2 tests in 2.40s after proving rejected positive ceiling input reproduces the exact baseline height plane and both fingerprints; working-tree lint passed.
- Remaining: Parent-owned combined gates and integration.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] packages/engine/src/world/generate/finiteFloorElevation.ts:103 — maximumElevation is normalized and fingerprinted over 0..4, but ordinaryHeight computes Math.min(0, input.maximumElevation). Every valid maximumElevation therefore produces the same ordinary ceiling of zero, while authored positive ramps are explicitly outside this control. Changing maximumElevation alters configuration identity without changing the height plane or floor fingerprint, so the exposed "maximum" control is behaviorally inert and the claimed normalized elevation range is incomplete.`
- Resolutions:
  - [P2] Resolved — `maximumElevation` now normalizes to the honest ordinary ceiling set `-1..0`. Generated-output coverage proves accepted `-1` lowers the ordinary ceiling, changes the height plane and both configuration/floor fingerprints, and remains movement-legal. Rejected positive input normalizes to `0` and reproduces the exact baseline plane and fingerprints. Inverted ranges normalize to an ordered pair.
- Verification:
  - Confirmed minimum elevation clamps deterministic ordinary terrain, seed `74621` contains real ordinary `z = -2` cells, repeated generation preserves the height plane, and the minimum change alters both configuration and floor fingerprints.
  - Confirmed post-elevation movement analysis reports no illegal edges for the representative floor and the authored stair/platform restamp remains after the ordinary pass.
  - Confirmed `packages/game-server/src/sim/combat/chasmDeath.test.ts` is unchanged and still distinguishes lethal explicit Void from walkable, nonlethal ordinary Floor at `z = -2`.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/game-server/src/sim/combat/chasmDeath.test.ts --maxWorkers=1 --reporter=verbose` — passed 4 files / 18 tests.
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - Coder correction: elevation/config tests passed 9/9; the full elevation/config/topology/chasm gate passed 19/19; engine and game-server typechecks plus working-tree lint passed.

### Round 2 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed `maximumElevation` now normalizes to the honest movement-safe ordinary ceiling set `-1..0`, and inverted ranges lower the minimum to the accepted ceiling.
  - Confirmed accepted `-1` output lowers the ordinary plane, changes configuration and floor fingerprints, and remains movement-legal; rejected positive input clamps to baseline `0` with identical height and fingerprints.
  - Confirmed deterministic minimum clamping, legal connected topology, authored ramp restoration, and the unchanged walkable/nonlethal ordinary `z = -2` chasm contract remain intact.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/game-server/src/sim/combat/chasmDeath.test.ts --maxWorkers=1 --reporter=verbose` — passed 4 files / 19 tests.
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.

## Memory candidates

- None.
