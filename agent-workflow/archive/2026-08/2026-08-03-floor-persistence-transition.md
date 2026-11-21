# Floor persistence and async descent fixtures

- Task: `2026-08-03-floor-persistence-transition`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/game-server/src/floors/floorPersistence.test.ts`, related
  floor-registry preparation/transfer test support, and only the production
  boundary required by a confirmed failure
- Preserve: `Client/editor/admin surfaces, engine generation, enemy behavior,
  terrain rendering, and unrelated dirty worktree changes.`

## Goal

Repair durable descent and party/restart coverage for the asynchronous floor
preparation boundary. The tests must await the same accepted transition
acknowledgement used by production instead of assuming a destination sim exists
after one synchronous tick.

## Plan

- [x] Reproduce the restart failure at the preparation boundary; the old
      synchronous `joinSim()` path timed out while rebuilding persisted floor 3.
- [x] Update the fixture to use the production async `prepareJoinSim()` boundary
      without making floor generation synchronous.
- [x] Add regression coverage asserting party/restart descent does not move
      before preparation acknowledgement and does move after it completes.
- [x] Record focused validation and hand off to review.

## Decisions

- Do not make floor preparation synchronous just to satisfy old tests.
- Preserve one shared preparation per destination floor.

## Handoff

- Changed:
  - `packages/game-server/src/floors/floorPersistence.test.ts`
- Implementation:
  - persisted restart now awaits `FloorRegistry.prepareJoinSim()`, matching
    the server join path and worker-backed destination preparation;
  - the descent fixture asserts the first tick has no moved transfer, awaits
    `waitForPendingFloorPreparations()`, then asserts the acknowledged move;
  - the first registry is disposed before constructing the restart registry,
    and the restarted registry is disposed after the resume assertions.
- Validation:
  - `npx vitest run packages/game-server/src/floors/floorPersistence.test.ts --maxWorkers=1`: **1 file, 5 tests passed**.
  - `npm run typecheck -w @dc2d/game-server`: passed.
  - `npx eslint packages/game-server/src/floors/floorPersistence.test.ts`: passed.
  - Adjacent focused command `npx vitest run packages/game-server/src/floors/floorPersistence.test.ts packages/game-server/src/floors/floorRegistryArtifact.test.ts packages/game-server/src/floors/preparation/floorPreparationQueue.test.ts --maxWorkers=1`: **2 files / 9 tests passed; 1 artifact-prewarm test failed** because unrelated floor-3 generation reports disconnected required cells `23..26,-124`. No generation code or assertion was weakened.
  - No server or port was started; 8787 was untouched.
- Remaining: the adjacent `floorRegistryArtifact` floor-3 generation failure
  remains outside this persistence fixture slice and is documented rather than
  changed here.

## Review

Status: `in-review`.

The async persistence boundary is ready for review. The unrelated artifact
prewarm generation failure is explicitly retained as a separate engine
generation/migration blocker.

Review round 1 — approved.

- `floorPersistence.test.ts:53-64` awaits the accepted
  `waitForPendingFloorPreparations()` boundary after asserting the first tick
  has no transfer, then verifies the acknowledged move; no production
  generation path was changed.
- The restart path at `floorPersistence.test.ts:71-92` awaits the production
  `prepareJoinSim()` boundary and disposes both registries at their lifecycle
  boundaries.
- Isolated focused persistence check: 1 file, 5 tests passed.
- `npm run typecheck -w @dc2d/game-server` passed.
- Scoped ESLint for `packages/game-server/src/floors/floorPersistence.test.ts`
  passed.
- The documented adjacent command reproduced the unrelated floor-3 artifact
  prewarm failure (`23..26,-124` disconnected); the other 9 adjacent tests
  passed. This remains outside this persistence-fixture slice.

No scoped findings remain. Move this card to `04_finalize` with Status
`in-review`.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: async floor-persistence fixture slice only; combined
  repository gates remain parent-owned.
- Final evidence: persistence suite 5/5 passed; game-server typecheck and
  scoped ESLint passed.
- The adjacent floor-3 artifact-prewarm failure remains documented as an
  unrelated migration issue and is covered by its own planned work.
- Master roadmap: persistence transition slice complete; trace, cold-path,
  fixture, faction, and browser acceptance slices remain planned.
