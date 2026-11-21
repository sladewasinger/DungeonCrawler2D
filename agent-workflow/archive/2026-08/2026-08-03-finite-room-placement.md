# Finite random room placement

- Task: `2026-08-03-finite-room-placement`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/engine/src/world/generate/**` room placement, authored feature ordering, and focused generation tests only
- Preserve: `All unrelated dirty worktree changes, admin/editor UI, runtime rendering, and release files.`

## Goal

Replace deterministic row/column room packing with reproducible seeded random
candidate placement across the full finite envelope. Materialize mandatory
territory structures/features first, connect their required ports, then fill
remaining space with ordinary rooms and maze. A room target counts retained
rooms; placement attempts remain internal. Failed authored contracts must not
produce a stale or partial usable preview.

## Plan

- [x] Inspect the current room candidate and feature reservation order.
- [x] Implement seeded random candidate sampling with collision, bounds, and
      reserved-feature rejection.
- [x] Keep authored structures and required connectors deterministic and
      materialized before ordinary room fill.
- [x] Add behavior-focused tests for reproducibility, non-grid placement,
      distribution across the envelope, and target-vs-attempt semantics.
- [x] Record focused validation and hand off to review.

## Decisions

- Room placement must follow the spirit of the Rooms and Mazes algorithm while
  preserving this project's mandatory feature contracts.
- Do not weaken validation or hide authored-feature failures with retries.

## Handoff

- Changed engine paths:
  - `packages/engine/src/world/generate/finiteFloorRooms.ts` — seeded,
    attempt-indexed room candidates across the full usable envelope; entrance
    admission now has a refill loop with one bounded private attempt budget,
    so the configured target counts retained rooms rather than pre-admission
    candidates.
  - `packages/engine/src/world/generate/finiteFloor.ts` — mandatory feature,
    territory, backbone, and port materialization precedes ordinary rooms and
    maze fill; required route targets use registered entrances and retained
    room/entrance links.
  - `packages/engine/src/world/generate/finiteFloorTopologyValidation.ts` — a
    successful attempt is rejected when retained ordinary rooms are below the
    normalized target.
  - `packages/engine/src/world/generate/finiteFloorMazeGeneration.ts` — maze
    starts with a width-aware finite-boundary margin so generated corridor
    cross-sections cannot strand an edge component.
  - `packages/engine/src/world/generate/territories/territoryLayoutPatterns.ts`
    — deterministic territory-component discovery/connection and bounded
    approach carving, with protected authored geometry preserved.
  - `packages/engine/src/world/generate/connections/finiteRegionBridges.ts` —
    bridge routes are preflighted transactionally before carving.
  - `packages/engine/src/world/generate/finiteFloorFeatureSet.ts` — room
    route targets prefer registered 1–2 tile entrances.
  - `packages/engine/src/world/generate/test-support/finiteFloorTopology.ts` —
    bounded topology movement fixture helpers moved out of the test module.
  - `packages/engine/src/world/generate/finiteFloorTopology.test.ts` —
    reproducibility, target-vs-attempt, non-grid, full-envelope distribution,
    authored geometry, corridor, loop, and orphan-region regressions.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=1 --testTimeout=60000` — **3 files / 19 tests passed**. The room-retention validation requires the explicit local 60-second budget because the configured target/refill path exercises bounded retries; no global timeout was changed.
  - Room-placement target/distribution assertion is included in that run and
    passed.
  - `npm run typecheck -w @dc2d/engine` — **passed**.
  - Scoped ESLint over all changed engine slice paths — **passed**.
  - `npm run lint:working-tree` — blocked outside this card by the pre-existing
    dirty client preview path
    `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
    (max-params and max-lines). Engine slice lint is clean; client/admin scope
    was intentionally not changed.
- Exploratory legacy result: `connections/connectivity.test.ts` still has its
  two district-layout failures (seed `760263878` north seam and widened seam
  width); that suite exercises the legacy district generator and is outside
  this finite room-placement card. It remains on the master migration docket.
- Remaining for review: reviewer should inspect the engine-only diff and the
  recorded unrelated working-tree lint blockers. No editor/admin work was
  started in this slice.

### Reviewer handoff — 2026-08-03

The scoped generation checks passed **3 files / 19 tests**. Changed-file lint
was attempted through `npm run lint:working-tree` and was blocked by the
pre-existing, out-of-scope client file
`packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
(`max-params` at line 64 and `max-lines` at line 164). No editor/admin files
were changed for this review.

## Review

### Luna review round 1 — 2026-08-03

Status: `changes-requested`

1. **P1 — configured room targets are not retained after entrance admission.**
   `placeRooms` stops when its pre-entrance `rooms.length` reaches
   `roomTargetCount` (`packages/engine/src/world/generate/finiteFloorRooms.ts:15-27`).
   The subsequent `registerRoomEntrances` pass can discard any candidate with
   no legal entrance (`packages/engine/src/world/generate/connections/roomEntrances.ts:18-31,58-77`),
   but generation does not refill the discarded slots and validation only
   requires two rooms (`packages/engine/src/world/generate/finiteFloorValidation.ts:74-84`).
   This violates the slice contract that the room target counts retained rooms;
   a seed/config can therefore return a successful floor with fewer ordinary
   rooms than requested while all focused tests still pass. Admission must be
   part of the attempt budget/target loop (or an equivalent refill pass), and
   the final attempt validator must reject a short retained room set before a
   floor or preview is exposed.

Validation evidence:

- `npx vitest run packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=1 --testTimeout=30000` — **3 files / 19 tests passed**.
- `npm run lint:working-tree` — blocked by the unrelated existing client
  `generationPreviewProjection.ts` errors at lines 64 and 164; no scoped engine
  lint errors were reported before that out-of-scope failure.

Handoff: changes requested for the room-retention contract. The card is moving
back to `02_implementation/` with `Status: changes-requested`. No
implementation, editor/admin, release, or master-roadmap files were edited.

### Luna review round 2 — 2026-08-03

Status: `in-review`

The P1 is resolved. Room admission now occurs before the target loop completes:
discarded rooms are refilled from the next deterministic candidate indices,
the total attempt budget remains bounded, and topology validation rejects any
short retained set. The focused generation/config/trace run passed **3 files /
19 tests** after the fix; engine typecheck and scoped ESLint also passed.

The only remaining working-tree lint output is the unchanged out-of-scope
client preview file documented above.

### Luna review round 3 — 2026-08-03

Status: `in-review`

Findings: None.

The prior P1 is resolved. `placeAdmittedRooms` refills only the missing
admitted-room count, resumes candidate indices at the prior `attemptsUsed`,
and passes only the remaining `roomAttemptBudget` to each refill
(`packages/engine/src/world/generate/finiteFloor.ts:172-198`). The admission
pass removes candidates without legal entrances before they count toward the
target (`packages/engine/src/world/generate/finiteFloor.ts:201-207`), while
the final topology validator rejects any short retained set before floor
acceptance (`packages/engine/src/world/generate/finiteFloorTopologyValidation.ts:74-84`).
The seeded reproducibility/distribution test asserts the retained target and
bounded attempt relationship (`packages/engine/src/world/generate/finiteFloorTopology.test.ts:72-92`),
and the focused run passed.

Validation:

- `npx vitest run packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/engine/src/world/generate/config/floorGenerationConfig.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=1 --testTimeout=60000` — **3 files / 19 tests passed**.
- `npx eslint` over the changed engine room-placement paths — passed.
- `npm run typecheck -w @dc2d/engine` — passed.
- `npm run lint:working-tree` — blocked only by the unchanged, out-of-scope
  `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
  errors at lines 64 and 164; no engine-slice lint finding remains.

Handoff: approved for parent-owned final gates. Status remains `in-review`; the
card is moving to `04_finalize`. No implementation, editor/admin, release, or
master-roadmap files were edited.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: engine room-placement slice only; repository-wide gates
  remain parent-owned until the complete finite-dungeon roadmap is ready.
- Focused evidence: 3 generation/config/trace files and 19 tests passed;
  engine typecheck and changed-path ESLint passed.
- Known combined-worktree issue: `npm run lint:working-tree` still reports
  the unrelated client preview file documented in the review above. It is
  tracked by the separate generation-preview slice and does not invalidate
  this engine-only approval.
- Memory promotion: the parent recorded the retained-room and workflow
  validation lessons in the relevant memory categories.
- Master roadmap: room-placement slice complete; preview, admin, rendering,
  performance, and remaining bug slices remain active/planned.
