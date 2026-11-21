# Engine finite-world core fixtures

- Task: `2026-08-03-engine-core-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/core/worldChunkCache.test.ts; packages/engine/src/world/worldFeatures.test.ts; packages/engine/src/navigation/gridPath.test.ts; nearest engine test-support factory and directly related tests; workflow records`
- Preserve: `All current dirty paths outside scope, engine production behavior, generator/topology coverage, server/client/admin/editor work, and release files.`

## Goal

Migrate core engine consumers to the shared finite fixture or explicit authored adapters without changing finite bounds, slicing, cache, feature, or pathfinding behavior.

## Plan

- [x] Classify each consumer by canonical finite metadata versus authored/sandbox behavior.
- [x] Use one nearest-domain test-support factory; derive locations from metadata instead of district coordinates.
- [x] Run focused core shards, engine typecheck, and changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- Real generator/topology assertions stay uncached and behaviorally authoritative.
- Finite chunk slicing, cache reconstruction, bounds, VOID-mode, and stair pathfinding consumers share one identity-valid floor per terrain mode through `world/core/fixtures/finiteWorldFixture.ts`; every `World` retains independent chunk and override state.
- Floor-zero sandbox and Combat Sandbox cases remain explicit authored compatibility adapters. The authoritative-floor handoff test constructs `World` directly because supplied-floor identity validation is the behavior under test.
- Generated locations come from spawn, descent, arena, and terrain-plane metadata. No district coordinate snapshot or whole-floor deep equality remains in these consumers.

## Handoff

- Changed: `packages/engine/src/world/core/fixtures/finiteWorldFixture.ts`; `packages/engine/src/world/core/worldChunkCache.test.ts`; `packages/engine/src/world/worldFeatures.test.ts`; `packages/engine/src/navigation/gridPath.test.ts`.
- Validation: `npx vitest run packages/engine/src/world/core/worldChunkCache.test.ts packages/engine/src/world/worldFeatures.test.ts packages/engine/src/navigation/gridPath.test.ts --maxWorkers=2` passed 3 files / 20 tests in 6.205s wall after replacing a redundant whole-floor equality traversal; no test timeout override remains.
- Validation: `npm run typecheck -w @dc2d/engine` passed. `npm run lint:working-tree` passed and reported only the three unchanged legacy folder-size baselines. Scoped `git diff --check` passed.
- Remaining: Parent-owned final gates and roadmap reconciliation; no review findings remain.

## Review

### Round 1 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings: None.
- Evidence:
  - `finiteWorldFixture.ts` shares one identity-valid floor per terrain mode while each constructed `World` keeps its own chunk cache, public floor clone, and terrain overrides.
  - `worldChunkCache.test.ts` retains authoritative-floor identity/isolation, authored floor-zero, finite slicing/reconstruction, room isolation, bounded cache, pruning, and out-of-bounds behavior without legacy district coordinates.
  - `worldFeatures.test.ts` separates canonical finite terrain-mode assertions from authored room and Combat Sandbox adapters, deriving representative cells from spawn, descent, arena, and terrain metadata.
  - `gridPath.test.ts` derives the stair approach from generated stair metadata while retaining the independent exact half-height jump-edge contract.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - `npx vitest run packages/engine/src/world/core/worldChunkCache.test.ts packages/engine/src/world/worldFeatures.test.ts packages/engine/src/navigation/gridPath.test.ts --maxWorkers=2` passed 3 files / 20 tests in 5.93s.
- Resolutions: No changes requested; the card is ready for parent-owned finalization.

## Memory candidates

- None.
