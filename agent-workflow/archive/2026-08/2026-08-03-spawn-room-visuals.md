# Spawn-room runtime visuals

- Task: `2026-08-03-spawn-room-visuals`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/client/src/render/terrain/**; packages/client/src/scenes/dungeon/**; packages/engine/src/world/features/rooms/spawnExterior/**; directly related tests and workflow records only`
- Preserve: `All unrelated dirty worktree changes, admin/editor surfaces, finite generator topology work except any directly proven spawn-room contract defect, and all release/infrastructure files.`

## Goal

Make the authored floor-one spawn room render as a complete playable room when
the player joins. The runtime view must show the correct floor/wall materials,
the spawn-room facade and door, and the intended boundary/cliff treatment
instead of the gray untextured plane shown in the supplied join screenshot.

## Acceptance criteria

- A fresh floor-one join renders the spawn-room floor with the same material
  family used by the authoritative finite floor; no gray fallback plane remains
  over the room.
- The visible spawn-room door/facade is present at the authored entrance and
  remains consistent with collision and the outside landing.
- The fix works in both normal runtime rendering and the deterministic editor/
  spectator terrain projection where those paths consume the same floor data.
- Existing finite bounds, reserved-plane isolation, lighting, and movement
  behavior remain intact.
- Add or update a focused regression that checks semantic/material identity and
  door presence without hardcoding configurable tuning values or screenshots as
  the only assertion.

## Plan

- [x] Trace the join-time spawn-room tile/feature data through `World`, terrain
      planning/material selection, and runtime chunk presentation; identify why
      the room becomes gray and why the door is absent.
- [x] Implement the smallest shared-path correction, preserving the authored
      spawn-room contract and avoiding a second renderer-specific material map.
- [x] Add focused regression coverage and verify a local runtime/editor
      screenshot on an explicit non-8787 port.
- [x] Run `npm run lint:working-tree` and hand the same card to review; parent
      owns the repository-wide gates.

## Decisions

- Treat the screenshot as a runtime visual defect, not as permission to change
  the spawn-room layout or finite-dungeon generation order.
- Prefer the authoritative terrain/material projection already used by normal
  finite-floor rendering; do not introduce a special spawn-room renderer.
- Austin's fresh-join confirmation establishes that the earlier gray fallback is no longer present: live runtime tiles now reach the shared terrain renderer. The remaining work was door/facade and material-identity proof, not another production material rewrite.
- The authoritative finite floor already exposes the spawn facade as Floor terrain with a Bedrock surface, a three-unit wall height, and a south-facing `DoorExit` feature above an ordinary Floor landing. `createTerrainSource`, `planTerrain`, and `atlasDraws` preserve those independent planes as bedrock cap, territory floor, door face, and cliff-edge geometry.
- No additional production mutation was justified. A focused regression now discovers the real `DoorExit` from finite floor data instead of copying tuning coordinates, and guards the shared runtime/editor-compatible projection path against losing the facade, door, landing material, or boundary treatment.

## Handoff

- Changed:
  - `packages/client/src/render/terrain/tests/spawnRoomVisualPlan.test.ts`
  - `agent-workflow/04_finalize/2026-08-03-spawn-room-visuals.md`
- Validation:
  - Austin manually confirmed that a fresh spawn-room runtime view renders live terrain tiles rather than the prior gray fallback.
  - `npx vitest run packages/client/src/render/terrain/tests/spawnRoomVisualPlan.test.ts packages/client/src/render/terrain/planning/tests/terrainPlannerRoomIsolation.test.ts packages/engine/src/world/features/rooms/spawnExterior/spawnRoomExterior.test.ts --maxWorkers=1 --reporter=verbose` — 3 files / 4 tests passed in 2.02s.
  - `npm run typecheck --workspace=@dc2d/client` — passed, including service-worker configuration.
  - `npm run typecheck --workspace=@dc2d/engine` — passed.
  - `npm run lint:working-tree` — passed; only documented baseline folder-size notices remain.
  - Isolated Chromium acceptance used client `5192` and ephemeral no-store server `8792` with Void disabled. A fresh floor-one join rendered the complete textured reserved room, and exiting it rendered the glowing authored door/facade, ordinary landing/corridor materials, wall faces, and boundary outlines with no page or console errors. Captures: `/tmp/dc2d-spawn-room-visuals.png` and `/tmp/dc2d-spawn-room-facade.png`.
- Remaining: Parent-owned repository-wide gates and integration.

## Review

### Round 1 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed the regression constructs an identity-valid finite world, discovers the real `DoorExit` from generated floor data, and exercises the shared `createTerrainSource` → `planTerrain` → `atlasDraws` path.
  - Confirmed it preserves independent surface/feature planes and asserts the bedrock facade cap, south-facing door face, ordinary landing material role, and boundary cliff treatment without copying configurable coordinates.
  - Inspected both recorded Chromium captures: the fresh join shows textured reserved-room terrain rather than a flat gray fallback; the exterior capture shows the illuminated facade/door, ordinary landing and corridor textures, wall faces, and boundary outlines. No page error is visible in either capture.
- Validation:
  - `npx vitest run packages/client/src/render/terrain/tests/spawnRoomVisualPlan.test.ts packages/client/src/render/terrain/planning/tests/terrainPlannerRoomIsolation.test.ts packages/engine/src/world/features/rooms/spawnExterior/spawnRoomExterior.test.ts --maxWorkers=1 --reporter=verbose` — passed 3 files / 4 tests.
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.

## Memory candidates

- Record any verified distinction between authored reserved-room geometry and
  finite-floor terrain materialization if it caused the gray fallback.
