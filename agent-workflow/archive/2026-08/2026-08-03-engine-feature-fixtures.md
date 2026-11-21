# Engine feature compatibility fixtures

- Task: `2026-08-03-engine-feature-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/features/{bossArena,descent,fixed,miniBossArena,rooms}/** tests and nearest test-support helpers; workflow records`
- Preserve: `All current dirty paths outside scope; feature production implementation, generation topology, client/server/admin/editor work, and release files.`

## Goal

Make feature compatibility tests use canonical prepared finite metadata only where required and explicit adapters otherwise, retaining real generation assertions.

## Plan

- [x] Replace stale district-coordinate assertions with feature metadata or relational behavior.
- [x] Keep mutable runtime state independent per test and retain uncached feature/generation coverage.
- [x] Run focused feature shards, engine typecheck, and changed-file lint.

## Decisions

- Reuse the persistent `sol-coder`; no Luna or Spark.
- Do not change feature product behavior to accelerate tests.
- Mini-boss arena and spawn-exterior integration use the identity-valid prepared finite floor and generated feature metadata. Coordinate scans and seed-specific geometry repetition are replaced by the canonical arena record while retaining deterministic repeat lookup and full geometry assertions.
- Isolated safe/personal/party/spawn room collision tests use a fresh floor-zero Sandbox adapter because authored room chunks bypass ordinary finite topology. Each test still gets independent `World`, chunk, and override state.
- Boss/descent placement and mini-boss density remain uncached seed-driven unit contracts. Full generator/topology assertions remain unchanged in their generation-owned shard.

## Handoff

- Changed: `packages/engine/src/world/features/fixtures/featureWorldFixture.ts`; `packages/engine/src/world/features/bossArena/bossArena.test.ts`; `packages/engine/src/world/features/descent/descent.test.ts`; `packages/engine/src/world/features/miniBossArena/miniBossArena.test.ts`; `packages/engine/src/world/features/miniBossArena/miniBossArenaOverrides.test.ts`; `packages/engine/src/world/features/rooms/roomChunkModes.test.ts`; `packages/engine/src/world/features/rooms/roomDoorPlacements.test.ts`; `packages/engine/src/world/features/rooms/roomExitCollision.test.ts`; `packages/engine/src/world/features/rooms/roomWorld.test.ts`; `packages/engine/src/world/features/rooms/spawnExterior/spawnRoomExterior.test.ts`.
- Validation: `npx vitest run packages/engine/src/world/features/bossArena packages/engine/src/world/features/descent packages/engine/src/world/features/fixed packages/engine/src/world/features/miniBossArena packages/engine/src/world/features/rooms --maxWorkers=2` passed 15 files / 52 tests in 5.264s wall. No scoped test timeout override remains.
- Validation: `npm run typecheck -w @dc2d/engine` passed. `npm run lint:working-tree` passed and reported only the three unchanged legacy folder-size baselines. Scoped `git diff --check` passed.
- Validation after review fix: the same 15-file / 52-test feature command passed in 2.442s wall. Engine typecheck and `npm run lint:working-tree` passed; lint reported only the unchanged legacy folder-size baselines.
- Remaining: Parent-owned final gates and roadmap reconciliation; no review findings remain.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - **P2 — the multi-seed boss-arena position contract no longer exercises the public selectors it claims to cover.** `packages/engine/src/world/features/bossArena/bossArena.test.ts:38-59`: the test now calls `pickRingChunkFrom(... isReserved: () => false)` and `bossArenaPlacementAtChunk()` directly, then proves that placement is inside the supplied chunk. It therefore bypasses `bossArenaChunk()`, including its reserved-feature avoidance, and bypasses `bossArenaGatePosition()` / `bossArenaSpawnAnchor()` on every one of these ten seeds. The preceding legacy case covers those public functions only for seed 13. Before this slice, the same multi-seed case compared all three public results, so a regression that makes a public gate or spawn use a different chunk can now pass despite the test title and file contract saying positions land in the chunk "its own chunk getter names." Restore the public-selector assertions across the multi-seed sample; keep the pure placement helper coverage separately if it is still useful.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - `npx vitest run packages/engine/src/world/features/bossArena packages/engine/src/world/features/descent packages/engine/src/world/features/fixed packages/engine/src/world/features/miniBossArena packages/engine/src/world/features/rooms --maxWorkers=2` passed 15 files / 52 tests in 2.06s.
- Resolutions:
  - `[P2 boss-arena selector coverage] Resolved. Every seed in the multi-seed sample now calls `bossArenaChunk()`, `bossArenaGatePosition()`, and `bossArenaSpawnAnchor()`. The case verifies both public positions match the pure placement helper for the public chunk, then proves each position lies inside that selected chunk.`

### Round 2 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings: None.
- Resolution verification:
  - The boss-arena P2 is resolved: all ten sampled floor-cap seeds exercise the public chunk, gate, and spawn selectors, compare both positions with the pure placement for the public chunk, and verify containment.
  - Canonical mini-boss and spawn-exterior integration still uses prepared finite metadata with independent `World` runtime state.
  - Safe, personal, party, and spawn-room tests still use fresh authored floor-zero adapters; seed-driven boss/descent and mini-boss density contracts remain uncached.
- Validation:
  - `npm run lint:working-tree` passed. Only the three unchanged legacy folder-size baselines were reported.
  - `npx vitest run packages/engine/src/world/features/bossArena packages/engine/src/world/features/descent packages/engine/src/world/features/fixed packages/engine/src/world/features/miniBossArena packages/engine/src/world/features/rooms --maxWorkers=2` passed 15 files / 52 tests in 2.03s.
- Resolutions: All review findings are resolved; the card is ready for parent-owned finalization.

## Memory candidates

- None.
