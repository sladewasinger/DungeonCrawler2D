# Client terrain and landmark fixtures

- Task: `2026-08-03-client-terrain-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/client/src/render/terrain/planning/** tests; packages/client/src/scenes/dungeon/{hud,minimap,world}/** tests; packages/client/src/three/** tests; packages/client/src/ui/hud/** tests; nearest fixture helpers and workflow records`
- Preserve: `All current dirty paths outside scope; terrain/HUD/Three production behavior, prediction work, admin/editor product work, engine/server work, and release files.`

## Goal

Migrate canonical-terrain client tests to prepared finite floors and state-only tests to complete explicit doubles without changing visual or gameplay contracts.

## Plan

- [x] Classify terrain-reading consumers versus visual/state-only consumers.
- [x] Derive finite metadata at fixture boundaries and reject incomplete doubles there.
- [x] Run terrain, HUD/landmark, and Three focused shards; client typechecks; changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- No expected pixel, material, or collision assertion may be weakened.
- Keep the prepared generated floor module-private so consumers receive independent
  `World` state while sharing one validated canonical artifact per terrain mode.
- Use real compatibility `World` subclasses/instances for authored and static-tile
  scenarios; use narrow complete objects only where production accepts a narrow port.

## Handoff

- Changed:
  - `agent-workflow/04_finalize/2026-08-03-client-terrain-fixtures.md`
  - `packages/client/src/testing/terrainWorldFixture.ts`
  - `packages/client/src/render/terrain/planning/terrainPlannerVoidMode.test.ts`
  - `packages/client/src/render/terrain/planning/tests/terrainPlannerRoomIsolation.test.ts`
  - `packages/client/src/scenes/dungeon/hud/minimap/minimapTerrainCache.test.ts`
  - `packages/client/src/scenes/dungeon/world/landmarks/compassLandmarks.test.ts`
  - `packages/client/src/scenes/dungeon/world/landmarks/fixtures/compassArenaMovementFixture.ts`
  - `packages/client/src/scenes/dungeon/world/stairwayProximity.test.ts`
  - `packages/client/src/scenes/dungeon/world/stairwayTick.test.ts`
  - `packages/client/src/three/client/ThreeActionController.test.ts`
  - `packages/client/src/three/client/ThreeSelectedActions.test.ts`
  - `packages/client/src/ui/hud/core/HudLiveState.test.ts`
  - `packages/client/src/ui/hud/core/HudMinimapSnapshot.test.ts`
  - `packages/client/src/ui/hud/model/HudCompass.test.ts`
- Validation commands and recorded outcomes:

  ```sh
  npx vitest run packages/client/src/render/terrain/planning/terrainPlannerVoidMode.test.ts packages/client/src/render/terrain/planning/tests/terrainPlannerRoomIsolation.test.ts
  ```

  Passed 2 files / 15 tests.

  ```sh
  npx vitest run packages/client/src/scenes/dungeon/hud/minimap/minimapTerrainCache.test.ts packages/client/src/scenes/dungeon/world/landmarks/compassLandmarks.test.ts packages/client/src/scenes/dungeon/world/stairwayProximity.test.ts packages/client/src/scenes/dungeon/world/stairwayTick.test.ts packages/client/src/ui/hud/model/HudCompass.test.ts packages/client/src/ui/hud/core/HudMinimapSnapshot.test.ts packages/client/src/ui/hud/core/HudLiveState.test.ts
  ```

  Passed 7 files / 36 tests.

  ```sh
  npx vitest run packages/client/src/three/client/ThreeActionController.test.ts packages/client/src/three/client/ThreeSelectedActions.test.ts
  ```

  Passed 2 files / 11 tests.

  ```sh
  npm run typecheck -w @dc2d/client
  npm run lint:working-tree
  ```

  Client and service-worker typechecks passed; changed-file lint, configuration
  documentation checks, and changed-folder size checks passed.
- Remaining: Parent-owned final gates and integration.

## Review

### Round 1 — `changes-requested`

- Reviewer: `primary-thread handoff audit`
- Findings:
  - `[P2] Workflow status used the unsupported value review instead of the canonical stage status.`
  - `[P2] Handoff summarized changed domains without naming every changed path.`
  - `[P2] Focused validation results did not include runnable commands.`
- Resolutions:
  - `[P2] Use Status: in-review and move the same card into 03_review after completing this handoff.`
  - `[P2] Record every terrain-fixture slice path explicitly in Changed.`
  - `[P2] Record the exact three focused test shards, client typecheck, and changed-file lint commands with outcomes.`

### Round 2 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] packages/client/src/render/terrain/planning/terrainPlannerVoidMode.test.ts:39 — The complete disabled-mode chunk case creates a finite terrain fixture but replaces its terrain with terrainAt: () => Floor. The no-VOID assertions therefore pass even if the prepared finite world starts returning VOID in that chunk, weakening the canonical-terrain coverage this slice is intended to migrate.`
- Resolutions:
  - `[P2] Resolved — The complete disabled-mode chunk now passes the prepared finite World through createTerrainSource(world), restoring real terrain, bounds, surface, height, and feature classification while retaining every no-VOID geometry assertion.`
- Validation:
  - `npx vitest run packages/client/src/render/terrain/planning/terrainPlannerVoidMode.test.ts packages/client/src/render/terrain/planning/tests/terrainPlannerRoomIsolation.test.ts` — passed 2 files / 15 tests after the correction.
  - `npm run typecheck -w @dc2d/client` — client and service-worker typechecks passed after the correction.
  - `npm run lint:working-tree` — passed after the correction; configuration-doc and changed-folder-size checks also passed.

### Round 3 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed the Round 2 case passes the prepared finite `World` through `createTerrainSource(world)`, restoring real terrain classification while retaining every no-VOID geometry assertion.
  - Confirmed the prior fixture, authored-world, state-only-double, visual, and gameplay criteria remain satisfied across the complete scoped diff.
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - Terrain planning shard — passed 2 files / 15 tests.
  - HUD, landmark, and stairway shard — passed 7 files / 36 tests; emitted only the existing localstorage path warning.
  - Three client shard — passed 2 files / 11 tests.

## Memory candidates

- None.
