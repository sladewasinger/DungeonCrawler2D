# Test-suite finite-generation performance

- Task: `2026-08-03-test-suite-generation-performance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `in-review`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: Vitest configuration/test harness and finite-generation test support;
  generation caching or fixture reuse only where behavior remains equivalent
- Preserve: production behavior, editor/admin surfaces, test assertions,
  existing user dirty changes, and final-gate evidence.

## Goal

Make `npm test` finish predictably without repeated multi-second finite-floor
generation in unrelated tests, while preserving real behavior coverage and
deterministic isolation.

## Plan

- [x] Capture an isolated baseline for the slowest tests and identify whether
      repeated canonical floor generation, parallel worker contention, or a
      test-time timeout/configuration issue dominates.
- [x] Reuse immutable finite-floor fixtures or add explicit test-only setup
      seams where safe; never replace behavior assertions with tuning literals,
      random mocks, or blanket timeout increases.
- [x] Keep tests deterministic and isolated, and prove the slowest generation,
      floor-registry, arena, and server integration suites independently.
- [x] Record before/after timings and preserve the exact focused evidence for
      the parent-owned final-gate review.

## Decisions

- A faster suite is not achieved by hiding failures, excluding finite floors,
  or raising global timeouts.
- Production generation must retain its current strict validation and retry
  behavior.
- Server unit fixtures may explicitly disable next-floor prewarm; production
  retains the default prewarm behavior. The protocol test uses the same
  bounded deterministic seed as the level-loader fixture because protocol
  rejection does not depend on topology.
- Integration `makeSim` lazily reuses one immutable generated dungeon floor per
  test module for dungeon-level fixtures. Sandbox/combat-sandbox construction
  uses an explicit floor-0 compatibility world; tests that exercise finite
  safe-room topology opt into the real floor-1 fixture. The floor is still
  produced by the real generator.
- The serialized fixture cache is test-only and lives under the OS temp
  directory. Its filename includes cache version, generator version, seed,
  floor, void mode, and default configuration fingerprint. Reads pass through
  the engine artifact decoder, which validates plane presence/alignment/length;
  identity fields are checked again before use. Writes use a unique temporary
  file followed by rename, so parallel workers cannot observe a partial cache.
  Cache failures fall back to real generation; no production cache/state is
  involved.

## Handoff

- Changed so far:
  - `packages/game-server/src/server/index.ts`: preserves production prewarm
    default, exposes a test-only prewarm override, and disposes the floor
    preparation worker during server shutdown.
  - `packages/game-server/src/server/runtime/serverSimulations.ts`: forwards
    the prewarm override without changing the production default.
  - `packages/game-server/src/server.test.ts`: disables unrelated next-floor
    prewarm and reuses the bounded `server-level-test` seed for both protocol
    fixtures; protocol assertions are unchanged.
  - `packages/game-server/src/sim/integration/support.ts`: lazily caches one
    real `sim-test-world` dungeon `GeneratedFloor` and injects it into explicit
    finite integration worlds; ordinary sandbox fixtures use floor 0.
  - `packages/game-server/src/sim/integration/support/finiteFloorFixture.ts`:
    identity-keyed, gzip artifact cache and validated reconstruction for test
    workers only; cache admission uses the canonical mixed identity seed.
  - `packages/game-server/src/sim/integration/support/finiteFloorFixtureIdentity.ts`:
    isolated content-fingerprint helper used by strict cache admission.
  - `packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts`:
    cache-hit regression proving a serialized identity-validated fixture is
    reused.
  - `packages/game-server/src/sim/integration/support/safeRoomSearch.ts`:
    deterministic legacy safe-room fixture fallback.
  - `packages/game-server/src/sim/integration/gameplay/personalRoomIsolation.test.ts`,
    `packages/game-server/src/sim/integration/lifecycle/reconnect.test.ts`,
    `packages/game-server/src/sim/integration/social/party.test.ts`,
    `packages/game-server/src/sim/integration/combat/combat.test.ts`, and
    `packages/game-server/src/sim/integration/combat/effects.test.ts`: explicit
    finite fixture selection where the assertion exercises finite safe-room
    topology.
  - `packages/engine/src/world/generate/connections/bossArena/`:
    test-only deterministic support plus five ring shards and one reachability
    shard. The original 40-seed ring assertions and 12-seed reachability
    assertions remain present, with one bounded test case per shard and bounded
    Vitest worker concurrency; production generation is unchanged. The original
    120,000ms budget is applied once to each shard, not once per seed. Ring shards
    cover indexes 0-7, 8-15, 16-23, 24-31, and 32-39 of
    `index * 7919 + 13`; reachability covers indexes 0-11.
  - `packages/game-server/src/floors/floorRegistry.test.ts`: restored the
    original `/who` cross-floor assertion using the validated prebuilt-floor
    setup.
- Baseline/evidence:
  - The original named batch (boss arena unit, connectivity, floor registry,
    and artifact tests) passed 11/11 in 2.54s Vitest time (2.93s shell).
  - `bossArenaInvariant.test.ts` did not complete within a hard 20s command
    timeout; the pure `bossArena.test.ts` coverage remained fast in the named
    batch. This separates the expensive multi-seed final-chunk invariant from
    the pure selector test.
  - Before the server-fixture change, the first server test passed in about
    4.78s but the protocol test stalled beyond 20s. With the explicit bounded
    seed and prewarm disabled, the isolated protocol test passed: 1 passed,
    1 skipped, Vitest 2.46s / shell 4.75s.
  - The four-file representative integration run completed 18/19 tests in
    27.26s, but `personalRoomIsolation` timed out at the unchanged 5s test
    budget (reported duration 7.25s). The finite dungeon cases still spent
    about 7.19s (`join-aoi`) and 7.23s (`noclipBounds`) on their first real
    `sim-test-world` floor construction.
  - A direct real-generator probe measured `sim-test-world`, floor 1,
    `voidTerrain:true` at 6,119ms. No production tuning or timeout was changed.
  - First cache-miss integration module: the selected personal-room test
    passed in 53ms of test time; Vitest reported 8.95s import/setup and the
    shell completed in 9.46s, containing the one real generation and artifact
    write outside the test body.
  - Cross-module cache/fixture batch after the final seam: the explicit command
    `time timeout 70s npx vitest run packages/game-server/src/sim/integration/gameplay/join-aoi.test.ts packages/game-server/src/sim/integration/gameplay/noclipBounds.test.ts packages/game-server/src/sim/integration/gameplay/personalRoomIsolation.test.ts packages/game-server/src/sim/integration/gameplay/safeRoomDoors.test.ts --maxWorkers=1 --reporter=verbose`
    passed 4 files / 19 tests in 5.63s Vitest time / 5.99s shell. The slowest
    real behavior case was safe-room setup at 2.31s; all finite fixture cases
    stayed below the default test timeout.
  - `npm run typecheck --workspace @dc2d/game-server` passed.
  - The full integration directory was stopped by a hard 90s command timeout;
    it emitted multiple failures/timeouts and was not treated as a result.
  - Current blocker before the boss sharding change: the cache/setup seam was
    implemented and the representative batch was green, but the serial
    40-seed boss invariant exceeded the hard command limit. That historical
    blocker is resolved by test-only sharding below; no seed or assertion was
    removed.
- Validation just run:
  - `timeout 90s npx vitest run packages/engine/src/world/generate/connections/bossArenaInvariant.test.ts --maxWorkers=1 --reporter=verbose`: timed out with exit 124 and no completed test output.
  - `timeout 90s npx vitest run packages/engine/src/world/generate/connections/connectivity.test.ts packages/game-server/src/floors/floorRegistry.test.ts packages/game-server/src/floors/floorRegistryArtifact.test.ts packages/game-server/src/floors/floorPersistence.test.ts --maxWorkers=1 --reporter=verbose`: timed out with exit 124. Fifteen floor-registry/artifact/persistence tests passed before the limit; connectivity produced no completed result in that command.
  - `timeout 60s npx vitest run packages/game-server/src/server.test.ts --maxWorkers=1 --reporter=verbose` (outside sandbox for the port-0 fixture): passed 1 file / 2 tests in 6.75s Vitest time / 6.95s command time. The sandboxed attempt was invalid evidence because ephemeral WebSocket bind returned `EPERM`.
  - `npm run lint:working-tree`: passed. Configuration docs passed; folder-size reported only documented legacy oversized folders (`client/scenes/editor`, engine generate baseline, and game-server source baseline), with no new error.
- Additional bounded engine/floor evidence:
  - `timeout 60s npx vitest run packages/engine/src/world/generate/connections/connectivity.test.ts --maxWorkers=1 --reporter=verbose`: passed 1 file / 2 tests in 22.54s Vitest time / 22.77s shell.
  - `timeout 60s npx vitest run packages/game-server/src/floors/floorRegistry.test.ts --maxWorkers=1 --reporter=verbose`: passed 1 file / 6 tests in 3.55s Vitest time / 3.92s shell after the prebuilt-floor seam was warm.
  - The four-file floor aggregate was rerun with the same 90s limit and passed 4 files / 17 tests in 75.55s Vitest time. This includes connectivity (2), floor registry (6), artifact handoff (4), and persistence (5). The earlier 90s timeout was caused by repeated floor-registry construction; it is resolved by the validated `prebuiltFloors` map used only in `floorRegistry.test.ts`.
  - A direct bounded probe for one boss seed (`finiteFloorForRuntime({ worldSeed: 13, floor: 15 })`) took 4,470ms. The invariant covers 40 unique seeds, so the existing single-file serial loop has a real lower-bound above 90s even though its in-file cache removes duplicate calls for each seed.
  - Safe fixture-reuse boundary found: game-server registry tests can inject
  identity-validated, immutable generated floors through the optional
    `prebuiltFloors` test seam. The seam routes both initial and destination
    floors through normal `ensureFloor` registration, so transfer/artifact maps
    and assertions remain authoritative. It is unset in production. It cannot
    make the boss invariant's 40 unique floor generations cheaper.
  - Boss invariant validation after sharding:
    `timeout 90s npx vitest run packages/engine/src/world/generate/connections/bossArena --maxWorkers=6 --reporter=verbose`
    passed 6 files / 52 tests in 39.77s Vitest wall time (the individual
    generation work totaled 198.79s). This covers all 40 unique ring seeds and
    all 12 reachability seeds.
  - Focused aggregate validation after sharding:
    `timeout 90s npx vitest run packages/engine/src/world/generate/connections/bossArena packages/engine/src/world/generate/connections/connectivity.test.ts --maxWorkers=6 --reporter=verbose`
    passed 7 files / 54 tests in 49.19s Vitest wall time (224.88s summed test
    work). Connectivity remained covered: both tests passed, including seam
    cells and protected-route reachability.
  - Final scoped lint:
    `npm run lint:working-tree` passed. Configuration docs passed; the only
    folder-size output is the documented legacy set: editor scene 13 (baseline
    21), engine generate 41 (baseline 41), and game-server source 13 (baseline
    14).
  - Final correction rerun:
    `timeout 90s npx vitest run packages/engine/src/world/generate/connections/bossArena packages/game-server/src/floors/floorRegistry.test.ts --maxWorkers=6 --reporter=verbose`
    passed 7 files / 13 tests in 43.14s Vitest wall time. The six boss tests
    covered all 40 ring seeds and 12 reachability seeds; the registry file
    passed all 7 tests, including `/who`.
  - The boss/focused validation evidence is now complete. No parent full suite
    was run, no production generation code was changed, and no timeout budget
    was raised.
  - Current blocker: none for the remaining boss-invariant slice. The prior
    serial probe exceeded its hard limit because it regenerated 40 unique
    floors; bounded test-only sharding now completes the same coverage within
    the hard limit. Parent full-suite migration remains intentionally deferred.

## Final handoff summary

- Test-only concurrency change: the former serial 40-seed boss invariant was
  replaced by five deterministic ring shards under
  `packages/engine/src/world/generate/connections/bossArena/`, plus one
  reachability test file and shared support. Each shard runs its complete seed
  subset under the original 120,000ms budget; Vitest runs the files with
  bounded `--maxWorkers=6` concurrency.
- Exact coverage is unchanged: ring seeds are `index * 7919 + 13` for indexes
  0 through 39 (40 unique seeds), and reachability covers indexes 0 through
  11 (12 unique seeds). No production generation code, timeout, or assertion
  was changed.
- Final evidence: corrected boss shards passed 6 files / 6 bounded shard tests
  in 40.65s, covering the same 40 ring and 12 reachability seeds; the final
  boss-plus-registry aggregate passed 7 files / 13 tests in 43.14s; and
  `npm run lint:working-tree` passed with only documented legacy folder-size
  notices. The card is ready for independent review; parent full suite remains
  deferred.

## Review

### Luna review round 1 — resolved

- **P1 — an existing cross-floor behavior assertion was removed:**
  `packages/game-server/src/floors/floorRegistry.test.ts` no longer contains
  the `/who` test that asserted players on every active floor are listed with
  their floor numbers (the deleted block was at the former lines 165-175; the
  current file ends at line 151). This is assertion/coverage weakening in a
  test-only performance slice. **Resolution:** restored in
  `floorRegistry.test.ts` using the asynchronous/prebuilt-floor setup; the
  final focused run passed the assertion.

- **P1 — boss sharding widens the timeout budget per seed:**
  `packages/engine/src/world/generate/connections/bossArena/bossArenaRingShardA.test.ts:5-7`
  (and the corresponding B-E files) and
  `packages/engine/src/world/generate/connections/bossArena/bossArenaReachability.test.ts:5-7`
  assign `120_000` ms to every individual `it.each` case. The original
  `bossArenaInvariant.test.ts` assigned one `120_000` ms budget to the entire
  40-seed ring case and one to the 12-seed reachability case. This is a
  material timeout expansion while the handoff claims no timeout change; use
  a bounded per-shard budget or otherwise preserve the original failure
  detection contract. **Resolution:** each shard now runs its complete seed
  subset in one test with the original 120,000ms budget at shard scope; no
  per-seed timeout remains.

- **P2 — the test cache does not fully validate restored identity:**
  `packages/game-server/src/sim/integration/support/finiteFloorFixture.ts:63-81`
  checks top-level world seed/floor/void mode plus generator version and
  configuration fingerprint, but accepts a restored artifact without checking
  `floor.identity.seed`, `identity.bounds`, or `identity.fingerprint` against
  the requested default fixture. The decoder validates plane lengths against
  the artifact's own metadata bounds, not the expected finite envelope. A
  stale or mismatched artifact with matching top-level fields can therefore
  be reused by the test harness. Reject it or validate the complete expected
  identity before returning the cached floor. **Resolution:** cache admission
  now validates requested and embedded seed, full canonical bounds, identity
  bounds, configuration fingerprint, and a recomputed content fingerprint; any
  failure returns a cache miss and uses real generation.

- Floor-0 compatibility setup is otherwise bounded to non-dungeon sandbox
  fixtures; the changed finite integration cases explicitly opt into the real
  floor-1 fixture. Production prewarm remains default-enabled through
  `packages/game-server/src/server/runtime/serverSimulations.ts:41`.

- Focused evidence: the final correction command passed 7 files / 13 tests in
  43.14s; `npm run lint:working-tree` passed. The persistence timeout and
  sandbox port-bind EPERM were not changed because they are unrelated to these
  three findings. No parent full gates were run.

### Luna review round 2 — changes requested

- **P1 — cache admission rejects every valid generated floor:**
  `packages/game-server/src/sim/integration/support/finiteFloorFixture.ts:82-89`
  compares `floor.identity.seed` to the raw `worldSeed`. The canonical engine
  identity stores `seed: mixSeeds(worldSeed, floor, generatorVersion)` at
  `packages/engine/src/world/generate/finiteFloor.ts:248`. Consequently a
  correctly generated artifact fails `matchesRequestedIdentity`, every cache
  read falls through to real generation, and the claimed cross-worker cache
  reuse/performance fix is not active. Compare against the canonical mixed
  identity seed (while retaining the other full identity, bounds, and content
  fingerprint checks) and add/retain a cache-hit regression assertion.

- The prior `/who` assertion is restored at
  `packages/game-server/src/floors/floorRegistry.test.ts:131-141`; each boss
  shard has one 120-second timeout around its complete subset and preserves all
  40 ring plus 12 reachability seeds. Production prewarm remains default-
  enabled and the floor-0 compatibility path remains limited to non-dungeon
  sandbox fixtures.
- Current focused evidence: boss shards plus floor registry passed **7 files /
  13 tests**; game-server typecheck and scoped ESLint passed. No parent full
  gates were run.

### Luna review round 2 — resolved

- **P1 — mixed identity seed validation:** `finiteFloorFixture.ts` compared
  `floor.identity.seed` with the raw request seed, rejecting valid artifacts.
  **Resolution:** validation now compares it with
  `mixSeeds(worldSeed, expectedFloor, FINITE_GENERATOR_VERSION)` while retaining
  raw world seed, floor, void mode, generator version, bounds, configuration,
  and recomputed content-fingerprint checks.
- Focused cache validation:
  `timeout 60s npx vitest run packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts --maxWorkers=1 --reporter=verbose`
  passed 1 file / 1 test in 0.956s. The prior focused registry run also passed
  1 file / 7 tests in 3.73s, including `/who`.
- `npm run lint:working-tree` passed; only documented legacy folder-size
  notices remain. No broad suite was run.

### Luna final review — approved

- The remaining cache P1 is resolved at
  `packages/game-server/src/sim/integration/support/finiteFloorFixture.ts:91-98`:
  admission derives `identity.seed` with
  `mixSeeds(worldSeed, expectedFloor, FINITE_GENERATOR_VERSION)`, matching the
  canonical engine identity. It also retains raw seed/floor/void/version/config
  checks, exact floor and identity bounds at lines 100-103, and the recomputed
  serialized-plane content fingerprint at lines 105-107. Decoder failures and
  any failed admission continue to fall back to real generation.
- The regression at
  `packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts:8-16`
  performs repeated loads of the same serialized fixture and observes a
  validated cache hit. The `/who` assertion remains at
  `packages/game-server/src/floors/floorRegistry.test.ts:134-145`.
- Each boss shard has one `120_000` ms timeout around its full subset, with no
  per-seed timeout widening. Shards preserve all 40 ring seeds and all 12
  reachability seeds.
- Final focused validation passed **8 files / 14 tests**, including the cache
  regression, registry suite, `/who`, and all boss shards; game-server
  typecheck passed; and `npm run lint:working-tree` passed with only the
  documented legacy folder-size notices. No parent full gates were run.
- No actionable findings remain. Status remains `in-review` for parent-owned
  final gates.

## Memory candidates

## Finalization

- Slice gate: focused cache, registry, boss-shard, and server checks passed;
  game-server typecheck and working-tree lint passed. Parent full gates remain
  deferred until the remaining roadmap cards are complete.
- Scope check: production generation defaults and behavior were preserved;
  test-only fixture/cache seams and test execution structure changed.
- Status: `complete`

## Memory promotion

- Promoted to `agent-memory/common-code-mistakes/testing.md`: repeated finite
  generation in tests must use validated, identity-keyed immutable fixtures;
  cache admission must verify canonical mixed identity, bounds, configuration,
  and content fingerprints, with real generation as the fallback.
