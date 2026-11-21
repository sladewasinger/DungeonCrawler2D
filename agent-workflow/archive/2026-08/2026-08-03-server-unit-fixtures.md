# Server unit finite-world fixtures

- Task: `2026-08-03-server-unit-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/game-server/src/sim/{enemies,pets,spawn,spawnSafety}/** tests and test-support; admin/announcer unit tests that directly construct a World; workflow records`
- Preserve: `All current dirty paths outside scope; server production gameplay/tuning, registry/integration lifecycle tests, client/engine/admin-editor product work, and release files.`

## Goal

Move server unit fixtures to either identity-valid canonical finite floors or the explicit floor-zero/authored adapter their behavior owns, retaining independent simulation state and RNG variation.

## Plan

- [x] Classify finite versus sandbox cases per fixture family.
- [x] Derive chasm, room, arena, and leader locations from generated metadata; retain behavior-based tuning assertions.
- [x] Run focused server-unit shards, game-server typecheck, and changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- Floor-zero conversion must not silently remove finite gameplay coverage.
- Dungeon bounds, spawn, chasm, room, pet, and mini-boss behavior use canonical
  generated floors with validated identity. Sandbox/admin/token/airborne-only
  behavior uses a fresh authored floor-zero world.
- Generic enemy AI uses the authored Combat Sandbox at floor 1 because those
  assertions own floor-scaled enemy definitions as well as flat authored
  terrain; each test still receives an independent World and SimState.
- Prepared immutable floor data is cached per seed/floor, while Worlds, stores,
  override state, encounter state, and RNG seeds remain per fixture.

## Handoff

- Changed paths owned by this slice:
  - `agent-workflow/04_finalize/2026-08-03-server-unit-fixtures.md`
  - `packages/game-server/src/sim/testing/finiteWorldTestSupport.ts`
  - `packages/game-server/src/server/admin/observer/adminStateSubscriptions.test.ts`
  - `packages/game-server/src/sim/admin/adminPetSpawning.test.ts`
  - `packages/game-server/src/sim/admin/adminSpawning.test.ts`
  - `packages/game-server/src/sim/announcer/spawnRoom/announcements.test.ts`
  - `packages/game-server/src/sim/enemies/enemies.test.ts`
  - `packages/game-server/src/sim/enemies/population/populationTestSupport.ts`
  - `packages/game-server/src/sim/enemies/population/testSupport/populationCohesionSupport.ts`
  - `packages/game-server/src/sim/enemies/populationCohesion.test.ts`
  - `packages/game-server/src/sim/enemies/roomIsolation/enemyRoomIsolation.test.ts`
  - `packages/game-server/src/sim/enemies/tests/combat/enemyAiCommittedAnimationSupport.ts`
  - `packages/game-server/src/sim/enemies/tests/combat/enemyAiRangedCadence.test.ts`
  - `packages/game-server/src/sim/enemies/tests/combat/enemyAiTargeting.test.ts`
  - `packages/game-server/src/sim/enemies/tests/elemental/arenaTestFixtures.ts`
  - `packages/game-server/src/sim/enemies/tests/elemental/flameTestFixtures.ts`
  - `packages/game-server/src/sim/enemies/tests/elemental/oilTestFixtures.ts`
  - `packages/game-server/src/sim/enemies/tests/enemyAiTestSupport.ts`
  - `packages/game-server/src/sim/enemies/tests/miniBoss/population.test.ts`
  - `packages/game-server/src/sim/enemies/tests/miniBoss/populationTestSupport.ts`
  - `packages/game-server/src/sim/enemies/tests/miniBossArena/miniBossArenaAggroTestSupport.ts`
  - `packages/game-server/src/sim/enemies/tests/miniBossArena/miniBossArenaLeader.test.ts`
  - `packages/game-server/src/sim/enemies/tests/miniBossArena/miniBossArenaTestSupport.ts`
  - `packages/game-server/src/sim/enemies/tests/training/trainingDummyTestSupport.ts`
  - `packages/game-server/src/sim/enemies/voidSafety.test.ts`
  - `packages/game-server/src/sim/pets/tests/petAirbornePhysics.test.ts`
  - `packages/game-server/src/sim/pets/tests/petBehaviorTestSupport.ts`
  - `packages/game-server/src/sim/pets/tests/pets.test.ts`
  - `packages/game-server/src/sim/spawn/playerSpawn.test.ts`
  - `packages/game-server/src/sim/spawn/spawn-radius.test.ts`
  - `packages/game-server/src/sim/spawn/spawn.test.ts`
  - `packages/game-server/src/sim/spawn/spawnGrace.test.ts`
  - `packages/game-server/src/sim/spawnSafety/spawnSafety.test.ts`
- Validation:
  - `npx vitest run packages/game-server/src/sim/enemies --maxWorkers=1` — passed 43 files / 183 tests after review fixes.
  - `npx vitest run packages/game-server/src/sim/pets packages/game-server/src/sim/spawn packages/game-server/src/sim/spawnSafety --maxWorkers=1` — passed 8 files / 40 tests.
  - `npx vitest run packages/game-server/src/sim/admin/adminPetSpawning.test.ts packages/game-server/src/sim/admin/adminSpawning.test.ts packages/game-server/src/sim/announcer/spawnRoom/announcements.test.ts packages/game-server/src/server/admin/observer/adminStateSubscriptions.test.ts --maxWorkers=1` — passed 4 files / 12 tests.
  - `npm run typecheck --workspace=@dc2d/game-server` — passed after review fixes.
  - `npm run lint:working-tree` — passed after review fixes; configuration-doc and changed-folder-size checks also passed.
- Remaining: Parent-owned combined-worktree final gates and integration.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] packages/game-server/src/sim/enemies/tests/combat/enemyAiTargeting.test.ts:36 — The migrated "limits simultaneous attackers" case now asserts only that the assignment count is between zero and the six spawned enemies. It no longer verifies ENEMY_SIMULATION_TUNING.perception.maximumAttackersPerPlayer (previously the expected count of three), so a regression that raises the cap to four or five passes this test despite the card's requirement to retain behavior-based tuning coverage.`
  - `[P2] packages/game-server/src/sim/enemies/population/testSupport/populationCohesionSupport.ts:69 — expectOptionalRoster accepts an enemy when its ID is native to any optional member's position via nativeAtEachPosition.some(...), rather than the same enemy's indexed position. Combined with the separate at-most-one mismatch check, this permits one non-native, non-random enemy whenever its ID happens to be native at another member's tile, weakening the intended "at most one random wanderer" contract.`
  - `[P2] agent-workflow/03_review/2026-08-03-server-unit-fixtures.md:31 — The handoff summarizes changed directories instead of enumerating every changed path and omits the runnable four-file admin/announcer command. With unrelated production and integration edits present in those directories, an independent reviewer cannot reproduce the slice boundary from the card alone.`
- Resolutions:
  - `[P2] Resolved — The assigned attacker count now equals ENEMY_SIMULATION_TUNING.perception.maximumAttackersPerPlayer while retaining the unassigned and target-ID checks.`
  - `[P2] Resolved — Each optional enemy is checked against nativeAtEachPosition[index]; only that same enemy's membership in RANDOM_ENEMY_ROSTER can admit the one mismatch.`
  - `[P2] Resolved — Handoff now lists each owned path literally and records the exact four-file admin/announcer command and outcome.`
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - `npx vitest run packages/game-server/src/sim/enemies --maxWorkers=1` — passed 43 files / 183 tests.
  - `npx vitest run packages/game-server/src/sim/pets packages/game-server/src/sim/spawn packages/game-server/src/sim/spawnSafety --maxWorkers=1` — passed 8 files / 40 tests.
  - `npx vitest run packages/game-server/src/sim/admin/adminPetSpawning.test.ts packages/game-server/src/sim/admin/adminSpawning.test.ts packages/game-server/src/sim/announcer/spawnRoom/announcements.test.ts packages/game-server/src/server/admin/observer/adminStateSubscriptions.test.ts --maxWorkers=1` — passed 4 files / 12 tests.

### Round 2 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] agent-workflow/03_review/2026-08-03-server-unit-fixtures.md:31 — The Round 1 handoff resolution enumerates all 32 implementation and test-support paths but still omits this workflow card, even though workflow records are explicitly in Scope and the resolution claims every owned changed path is listed. The slice boundary therefore remains one path short of the stated review contract.`
- Resolutions:
  - `[P2] Resolved — The Changed paths list now includes the workflow card at its returned review-stage path.`
- Verification:
  - Confirmed the attacker count now equals `ENEMY_SIMULATION_TUNING.perception.maximumAttackersPerPlayer` while retaining the unassigned and target-ID assertions.
  - Confirmed each optional enemy is matched against its own indexed native roster and only `RANDOM_ENEMY_ROSTER` membership permits the single mismatch.
  - Confirmed every listed implementation and test-support path exists and the exact four-file command is reproducible.
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - Enemy shard — passed 43 files / 183 tests.
  - Pet, spawn, and spawn-safety shard — passed 8 files / 40 tests.
  - Admin/announcer shard — passed 4 files / 12 tests.

### Round 3 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed the scoped workflow record is now present in the literal owned-path list and updated for its finalization-stage location.
  - Prior implementation findings remain resolved; no implementation scope changed after the clean Round 2 validation.
- Validation:
  - Not rerun for this handoff-only correction; Round 2's changed-file lint and focused shards remain the applicable clean evidence.

## Memory candidates

- None.
