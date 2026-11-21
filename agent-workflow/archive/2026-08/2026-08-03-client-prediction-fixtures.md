# Client prediction and snapshot fixtures

- Task: `2026-08-03-client-prediction-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/client/src/net/prediction/**; packages/client/src/net/snapshots/**; packages/client/src/input/movementEdges.test.ts; directly related finite fixture helpers and workflow records`
- Preserve: `All current dirty paths outside scope; client production prediction/input behavior, terrain/HUD/admin/editor work, server/engine work, and release files.`

## Goal

Migrate prediction, readiness, and snapshot tests to identity-valid finite fixtures or complete explicit test worlds without altering production movement or protocol behavior.

## Plan

- [x] Derive collision, stairs, and ports from finite metadata; preserve readiness and floor-transition identity assertions.
- [x] Make lightweight worlds interface-complete at their fixture boundary.
- [x] Run focused prediction/snapshot checks, client typechecks, and changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- Do not rewrite assertions merely to match a cached floor.
- Finite prediction Worlds reuse one identity-valid prepared floor while each `World` retains independent chunks and overrides. Prediction bodies derive from generated spawn metadata; collision scans use finite bounds; descent movement derives its start, direction, and stair assertion from generated port/stair metadata.
- Snapshot stamina and keyboard-edge tests use the explicit floor-zero Sandbox adapter and declare connection readiness. The collision-free modifier timeline uses a real `World` subclass overriding the complete `WorldView` terrain surface instead of casting a partial object.
- The fixture uses the shared normalized 74621 generation identity, avoids redundant whole-floor cloning before `World` construction, and passes `expectedGeneration` on every finite World.

## Handoff

- Changed: `packages/client/src/net/prediction/predictionTestSupport.ts`; `packages/client/src/net/prediction/prediction.test.ts`; `packages/client/src/net/prediction/predictionLifecycle.test.ts`; `packages/client/src/net/prediction/predictionReconciliation.test.ts`; `packages/client/src/net/prediction/movement/predictionMovementTimelineSupport.ts`; `packages/client/src/net/snapshots/staminaSnapshot.test.ts`; `packages/client/src/input/movementEdges.test.ts`.
- Validation: `npx vitest run packages/client/src/net/prediction packages/client/src/net/snapshots packages/client/src/input/movementEdges.test.ts --maxWorkers=2` passed 12 files / 31 tests in 3.518s wall.
- Validation: `npm run typecheck -w @dc2d/client` passed both client and service-worker TypeScript projects. `npm run lint:working-tree` passed and reported only the three unchanged legacy folder-size baselines. Scoped `git diff --check` passed.
- Remaining: Parent-owned final gates and roadmap reconciliation; no review findings remain.

## Review

### Round 1 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings: None.
- Evidence:
  - Finite prediction Worlds reuse the normalized fixture floor while passing `generatedFloor`, matching generation configuration, and `expectedGeneration`; each `World` retains independent runtime chunks and overrides.
  - Spawn, collision, bounds, descent-port, and stair assertions derive from finite metadata instead of legacy coordinates.
  - Snapshot stamina and keyboard-edge tests use an explicit floor-zero Sandbox adapter and declare connection readiness.
  - The collision-free movement timeline uses a concrete `World` subclass implementing the complete required `WorldView` movement surface.
- Validation:
  - `npm run lint:working-tree` passed with no slice-relevant warnings.
  - `npx vitest run packages/client/src/net/prediction packages/client/src/net/snapshots packages/client/src/input/movementEdges.test.ts --maxWorkers=2` passed 12 files / 31 tests in 3.07s.
- Resolutions: No changes requested; the card is ready for parent-owned finalization.

## Memory candidates

- None.
