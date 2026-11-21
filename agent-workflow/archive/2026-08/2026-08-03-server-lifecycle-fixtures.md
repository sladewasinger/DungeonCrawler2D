# Server lifecycle finite-world fixtures

- Task: `2026-08-03-server-lifecycle-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/game-server/src/floors/** tests; packages/game-server/src/server.test.ts; network diagnostics tests; packages/game-server/src/sim/integration/{support,**} finite fixture helpers and bounded lifecycle tests; workflow records`
- Preserve: `All current dirty paths outside scope; server production lifecycle/prewarm behavior, server unit fixtures, client/engine/admin-editor product work, and release files.`

## Goal

Make registry, server, and lifecycle tests prepare only the finite floors they own while retaining one authoritative production prewarm-chain test and complete worker/server cleanup.

## Plan

- [x] Reuse the identity-validated prebuilt-floor seam and classify floor-zero versus canonical integration cases.
- [x] Preserve default production prewarm and authoritative floor-1 to floor-3 coverage.
- [x] Run focused registry/server/lifecycle shards plus one bounded parallel aggregate, typecheck, and changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- Environment-only socket restrictions remain visible and are not turned into skips.
- Registry tests inject identity-validated artifacts for exactly the floors they own; the retained production-chain test deliberately uses the real worker path with prewarming enabled.
- The authoritative production assertion is `prewarms the authoritative floor-1 to floor-2 to floor-3 artifact chain` in `floorRegistryArtifact.test.ts`.
- Ordinary authored sandbox scenarios remain on floor zero. Tests that exercise finite terrain, safe rooms, bounds, descent, portals, or reconnect behavior opt into the canonical integration artifact explicitly.
- Registry fixtures await pending preparation before disposing their worker, and socket tests close clients, stop servers, await pending preparation, and dispose registries in `finally` blocks.

## Handoff

Owned changed paths:

- `packages/game-server/src/floors/floorRegistryTestSupport.ts`
- `packages/game-server/src/floors/floorPersistence.test.ts`
- `packages/game-server/src/floors/floorRegistry.test.ts`
- `packages/game-server/src/floors/floorRegistryArtifact.test.ts`
- `packages/game-server/src/floors/floorRegistryReuse.test.ts`
- `packages/game-server/src/floors/registry/floorRegistryApply.test.ts`
- `packages/game-server/src/server.test.ts`
- `packages/game-server/src/server/telemetry/networkDiagnostics.test.ts`
- `packages/game-server/src/sim/integration/support.ts`
- `packages/game-server/src/sim/integration/support/safeRoomSearch.ts`
- `packages/game-server/src/sim/integration/support/terrainSearch.ts`
- `packages/game-server/src/sim/integration/combat/combat.test.ts`
- `packages/game-server/src/sim/integration/combat/effects.test.ts`
- `packages/game-server/src/sim/integration/gameplay/fistbump-contacts.test.ts`
- `packages/game-server/src/sim/integration/gameplay/items.test.ts`
- `packages/game-server/src/sim/integration/gameplay/petDoorInteraction.test.ts`
- `packages/game-server/src/sim/integration/gameplay/safeRoomDoors.test.ts`
- `packages/game-server/src/sim/integration/lifecycle/reconnect.test.ts`
- `packages/game-server/src/sim/integration/lifecycle/reviveLifecycle.test.ts`
- `packages/game-server/src/sim/integration/party/craftingAndStash.test.ts`
- `packages/game-server/src/sim/integration/social/party.test.ts`
- `agent-workflow/04_finalize/2026-08-03-server-lifecycle-fixtures.md`

Retained and validated in-scope fixture work already present in the shared tree:

- `packages/game-server/src/sim/integration/support/finiteFloorFixture.ts`
- `packages/game-server/src/sim/integration/support/finiteFloorFixtureIdentity.ts`
- `packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts`
- `packages/game-server/src/sim/integration/gameplay/join-aoi.test.ts`
- `packages/game-server/src/sim/integration/gameplay/noclipBounds.test.ts`
- `packages/game-server/src/sim/integration/gameplay/personalRoomIsolation.test.ts`

Validation commands and outcomes:

```bash
npx vitest run packages/game-server/src/floors --maxWorkers=1
```

Passed 7 files / 23 tests.

```bash
npx vitest run packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts packages/game-server/src/sim/integration/combat/combat.test.ts packages/game-server/src/sim/integration/combat/effects.test.ts packages/game-server/src/sim/integration/gameplay/fistbump-contacts.test.ts packages/game-server/src/sim/integration/gameplay/items.test.ts packages/game-server/src/sim/integration/gameplay/join-aoi.test.ts packages/game-server/src/sim/integration/gameplay/noclipBounds.test.ts packages/game-server/src/sim/integration/gameplay/personalRoomIsolation.test.ts packages/game-server/src/sim/integration/gameplay/petDoorInteraction.test.ts packages/game-server/src/sim/integration/gameplay/safeRoomDoors.test.ts packages/game-server/src/sim/integration/lifecycle/reconnect.test.ts packages/game-server/src/sim/integration/lifecycle/reviveLifecycle.test.ts packages/game-server/src/sim/integration/party/craftingAndStash.test.ts packages/game-server/src/sim/integration/social/party.test.ts --maxWorkers=1
```

Passed 14 files / 59 tests.

```bash
npx vitest run packages/game-server/src/server.test.ts packages/game-server/src/server/telemetry/networkDiagnostics.test.ts --maxWorkers=1
```

Passed 2 files / 4 tests.

```bash
npx vitest run packages/game-server/src/floors/floorRegistry.test.ts packages/game-server/src/floors/floorRegistryArtifact.test.ts packages/game-server/src/sim/integration/lifecycle/reconnect.test.ts packages/game-server/src/server/telemetry/networkDiagnostics.test.ts --maxWorkers=2
```

Passed 4 files / 19 tests.

```bash
npx vitest run packages/game-server/src/sim/integration/gameplay/safeRoomDoors.test.ts packages/game-server/src/sim/integration/lifecycle/reviveLifecycle.test.ts --maxWorkers=1
npm run typecheck --workspace=@dc2d/game-server
npm run lint:working-tree
```

Passed 2 files / 9 tests; typecheck and changed-file lint passed.

- Remaining: Parent-owned repository-wide final gates and integration.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] packages/game-server/src/sim/integration/support/safeRoomSearch.ts:23 — findSafeRoomDoor falls back to a legacy safe-room door whenever no generated door is found, even when sim.world.generatedFloor exists. A canonical floor whose safe-room metadata or stamped door regresses therefore silently exercises the legacy authored room instead of failing the finite integration fixture, defeating the card's finite safe-room coverage.`
  - `[P2] packages/game-server/src/sim/integration/lifecycle/reviveLifecycle.test.ts:85 — The test named "keeps the revive window at 15 seconds" now waits RESPAWN_DELAY_TICKS + 1 before asserting respawn. The production timer is scheduled for exactly sim.tickCount + RESPAWN_DELAY_TICKS, so this permits a one-tick-late respawn regression that the prior exact boundary assertion rejected.`
  - `[P2] agent-workflow/03_review/2026-08-03-server-lifecycle-fixtures.md:32 — Changed paths are compressed into summaries and the 14-file integration shard plus four-file parallel aggregate are recorded only by description and result, not runnable commands. With unrelated lifecycle production edits in the shared tree, the card does not independently reproduce either its exact diff boundary or all required validation.`
- Resolutions:
  - `[P2] Resolved — The legacy fallback is used only without a generated floor. A generated fixture with no resolvable stamped safe-room door now throws, with explicit regression coverage.`
  - `[P2] Resolved — The respawn test now proves the player remains dead through RESPAWN_DELAY_TICKS - 1 and respawns on the next, exact deadline tick.`
  - `[P2] Resolved — The handoff enumerates every owned path literally and records runnable commands and outcomes for all focused and parallel shards.`
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - `npx vitest run packages/game-server/src/floors --maxWorkers=1` — passed 7 files / 23 tests.
  - Selected finite integration shard — passed 14 files / 58 tests.
  - `npx vitest run packages/game-server/src/server.test.ts packages/game-server/src/server/telemetry/networkDiagnostics.test.ts --maxWorkers=1` — passed 2 files / 4 tests.
  - Bounded registry/reconnect/diagnostics aggregate with `--maxWorkers=2` — passed 4 files / 19 tests.

### Round 2 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed legacy safe-room fallback is restricted to authored worlds and generated fixtures throw when metadata cannot resolve a stamped door; the failure path has explicit regression coverage.
  - Confirmed the respawn test proves the player remains dead one tick before the deadline and respawns exactly on the deadline.
  - Confirmed the handoff enumerates literal owned paths and supplies runnable commands for every focused and parallel shard.
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - Floor shard — passed 7 files / 23 tests.
  - Finite integration shard — passed 14 files / 59 tests.
  - Server/diagnostics shard — passed 2 files / 4 tests.
  - Bounded parallel aggregate — passed 4 files / 19 tests.
  - Safe-room and respawn review-fix shard — passed 2 files / 9 tests.

## Memory candidates

- None.
