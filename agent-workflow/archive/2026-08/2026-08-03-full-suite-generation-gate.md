# Full-suite finite-generation gate recovery

- Task: `2026-08-03-full-suite-generation-gate`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: root causes exposed by the parent `npm test` gate, finite-floor test
  construction/performance seams, and stale protocol/test fixtures
- Preserve: gameplay behavior, editor/admin surfaces, workflow records, and
  unrelated dirty worktree changes.

## Goal

Make the complete test suite a meaningful release gate after the finite-floor
migration. Eliminate repeated expensive generation and repair compatibility
fixtures without masking failures with a global timeout increase or weakening
behavioral assertions.

## Evidence to classify

- Parent gate: **119 failed files / 565 passed**, **165 failed tests / 2,694
  passed**, 483.68s total.
- Many failures are 5–6 second timeouts from tests constructing fresh finite
  `World`/`FloorRegistry` instances; some arena/floor tests ran for tens or
  hundreds of seconds.
- Concrete non-timeout failures include missing floor-transfer generation
  identity in prediction integration fixtures, missing finite bounds or
  expected wall approaches in prediction fixtures, stale input/action
  expectations, and a mini-boss room lookup returning no rooms.

## Plan

- [x] Reproduce a representative timeout and classify whether the cause is
      production generation cost, duplicated test setup, worker contention, or
      a fixture that should use an authoritative prepared floor.
- [x] Add safe test-only fixture/preparation reuse with complete identity
      validation, or optimize the production path if the runtime itself is the
      bottleneck. Do not add a global timeout or silently skip tests.
- [x] Repair the reproduced stale readiness, protocol, and finite-world
      fixtures to match the
      current authoritative contracts, asserting behavior rather than raw
      configurable values.
- [ ] Resolve the remaining repository-wide finite-world setup cost and
      semantic fixture failures, including the visual barrier defect reported
      from the editor preview. Only then move this same card to review; parent
      owns the next complete `npm test` gate.

## Decisions

- Preserve test isolation and deterministic seed/configuration identity.
- Treat fast assertion failures separately from generation timeouts; do not
  dismiss them as collateral without reproducing them.
- Keep any cache or prepared-floor seam test-only unless profiling proves a
  production optimization is required for runtime performance.

## Handoff

- The first implementation pass was reviewed, but the parent final gate
  returned this card to implementation. The card remains the source of truth
  for the next bounded recovery pass.
- Actual changes in this bounded pass:
  - `packages/client/src/input/movementEdges.test.ts` and
    `packages/client/src/net/connection/connection.test.ts` now mark their
    synthetic connections `worldReady`, matching the production send gates.
  - `packages/client/src/net/snapshots/staminaSnapshot.test.ts` now marks the
    snapshot fixture ready before exercising local resource prediction.
  - `packages/client/src/net/prediction/predictionTestSupport.ts` adds a
    lazily prepared, cloned finite floor fixture; finite prediction tests use
    it while the explicit open-world movement timeline stays an authored
    legacy fixture. The wall-approach helper scans the generated envelope and
    the reconciliation test derives its stair/port fixture from metadata.
  - `packages/client/src/net/prediction/prediction.test.ts`,
    `predictionLifecycle.test.ts`, `predictionReconciliation.test.ts`, and
    `movement/predictionMovementTimelineSupport.ts` consume those semantic
    fixtures.
  - `packages/engine/src/navigation/gridPath.test.ts` derives the stair and
    low-end port from generated feature metadata instead of stale coordinates.
  - `packages/game-server/src/sim/enemies/population/populationTestSupport.ts`
    and `populationCohesion.test.ts` reuse one identity-valid finite floor and
    preserve per-case RNG seed variation; `floorRegistryDirectory.test.ts`
    now supplies prebuilt floor fixtures, freezes unrelated enemy work, and
    disposes its worker.
- Root-cause evidence:
  - The finite trace/chunk timeout shard completed **2 files / 19 tests** in
    **27.35s**; the authoritative World handoff case alone took **11.035s**.
    This is repeated finite setup cost, not an unbounded generation loop.
  - The initial client semantic shard had **7 failures / 15 passes**. The
    failures mapped to readiness-gated input, a legacy sandbox fixture lacking
    finite bounds/open movement, a stale coordinate stair fixture, and the
    movement timeline's need for an explicit open test world.
- Focused checks completed:
  - `npx vitest run packages/client/src/net/prediction packages/client/src/input/movementEdges.test.ts packages/client/src/net/connection/connection.test.ts packages/client/src/net/snapshots/staminaSnapshot.test.ts --maxWorkers=1 --reporter=verbose` — **11 files / 38 tests passed**, **12.92s**.
  - `npx vitest run packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts packages/engine/src/world/core/worldChunkCache.test.ts packages/engine/src/navigation/gridPath.test.ts packages/game-server/src/sim/integration/support/finiteFloorFixture.test.ts --maxWorkers=1 --reporter=verbose` — **4 files / 22 tests passed**, **30.22s**.
  - `npx vitest run packages/game-server/src/sim/enemies/populationCohesion.test.ts packages/game-server/src/sim/enemies/population/nearSpawn.test.ts --maxWorkers=1 --reporter=verbose` — **2 files / 16 tests passed**, **7.86s**. The previously timing-out pack case completed in **25ms** after fixture reuse.
  - `npx vitest run packages/client/src/net/sync/apply.test.ts packages/client/src/net/sync/transition/applyFloorTransitionAcceptance.test.ts --maxWorkers=1 --reporter=verbose` — **2 files / 14 tests passed**, **19.72s**.
  - `npm run lint:working-tree` — passed; only documented legacy folder-size warnings remain (editor 13 / baseline 21, engine generate 41 / baseline 41, game-server src 13 / baseline 14).
- Historical blocker: `timeout 35s npx vitest run packages/game-server/src/floors/floorRegistryDirectory.test.ts --maxWorkers=1 --reporter=verbose` exited **124** without a test result, even after the prebuilt-fixture, freeze-enemy, and worker-dispose test seam. The duplicate path was subsequently removed after its `/who` contract was verified in `floorRegistry.test.ts`; no timeout increase masks it.
- Not run: `npm test`, full repository gates, ports, or subagents.

## Floor-registry directory disposition

The standalone `floorRegistryDirectory.test.ts` was a duplicate of the
authoritative `/who` coverage already present in `floorRegistry.test.ts`.
Both asserted that players on floors 1 and 2 appear in the cross-floor system
chat response with their floor numbers. The authoritative test uses the shared
identity-validated prepared-floor registry fixture and remains retained; only
the duplicate standalone file was removed. This removes the directory shard
that stalled without deleting the behavior contract.

Focused validation after consolidation:

- `npx vitest run packages/game-server/src/floors/floorRegistry.test.ts
  --testNamePattern="/who lists players" --maxWorkers=1 --reporter=verbose`
  — passed: 1 test passed, 6 tests skipped, 2.26s total.
- `npm run lint:working-tree` — passed; only the documented legacy folder-size
  warnings remain.

## Parent final-gate findings — 2026-08-03

- `npm run lint` passed; the same four documented legacy folder-size warnings
  remain.
- `npm run typecheck` passed for engine, content, game-server, and client.
- `npm test` remains red: **111 failed files / 572 passed**, **152 failed
  tests / 2,706 passed**, 683 files total, 474.60 seconds.
- Most failures are five-second finite-world construction/setup timeouts across
  engine, client, and game-server suites. Remaining concrete semantic failures
  include missing floor-transfer generation identity in the prediction
  integration suites, `World.downStairwayPositions` missing from a lightweight
  client test world, and a mini-boss room lookup returning no rooms.
- Product acceptance also still fails: the editor generation preview shows
  long sealed horizontal and vertical wall runs spanning large portions of the
  map. The earlier crossing test did not prove that ordinary generated walls
  are bounded or traversable in the rendered stage.
- Parent disposition: return this card to implementation. Do not archive this
  card or the v0.9.0 release plan until the next focused fixes and a clean
  repository-wide gate.

## Review

Ready for review. The duplicate directory test remains consolidated, and the
bounded barrier/high-target preview acceptance is now green.

### Luna review round 1 — approved

- Readiness-gated fixtures set `worldReady` before exercising input,
  connection, and stamina send/prediction gates; the focused client shard
  passed 11 files / 38 tests.
- `predictionTestSupport.ts` reuses a lazily prepared finite floor only through
  cloned `GeneratedFloor` instances and derives wall approaches from finite
  bounds and walkability/elevation geometry. `gridPath.test.ts` derives the
  stair and low-end port from generated stair metadata. The focused engine and
  fixture shard passed 4 files / 22 tests.
- `finiteFloorFixture.ts` validates world seed, floor, void mode, canonical
  mixed identity, generator version, configuration fingerprint, exact bounds,
  and the complete content-plane fingerprint before accepting a serialized
  cache entry; callers receive clones. The cache-hit regression passed 1 test.
- Population and `FloorRegistry` changes are test fixtures only. Population
  cases retain per-case RNG seeds, while the registry uses prebuilt floors
  without changing runtime production code. Population focused checks passed
  2 files / 16 tests; the sync/floor-transition checks passed 2 files / 14
  tests.
- `floorRegistryDirectory.test.ts` is absent, and the retained authoritative
  `floorRegistry.test.ts:134-144` asserts `/who` includes active players on
  floors 1 and 2 with `F1`/`F2`; that focused test passed 1 test with 6 other
  tests excluded by the explicit name pattern.
- No scoped global timeout, skip, weakened assertion, port `8787`, or agent
  spawning was introduced. The only added timeouts are test-local bounds on
  finite-generation cases. `npm run lint:working-tree` passed; only the
  documented legacy folder-size notices remain. No full repository gate was
  run.

No actionable finding remains in this bounded slice. Status remains `in-review`
for parent final gates.

### Luna review round 2 — approved

- `packages/engine/src/world/generate/finiteFloor.ts:179-205` refills room
  admission only from the remaining deterministic attempt budget and returns
  the rooms actually admitted. `finiteFloorTopologyValidation.ts:12-22,74-127`
  still enforces mandatory feature ports, room reachability, spanning merges,
  protected valid connectors, loops/path savings, dead-end policy, corridor
  width bounds/variation, territories, and required connected walkable cells;
  only the ordinary room target is best-effort.
- `packages/engine/src/world/generate/connections/bridges/finiteMazeBarrierSegmentation.ts:40-87`
  uses a pure deterministic width-derived opening schedule. The wiring in
  `finiteMazeCrossings.ts:35-75,103-143` admits openings only through
  uncarved, unprotected, non-room-wall cells, preserves distinct-region links
  as protected connectors, and keeps same-region ordinary openings out of
  connector accounting.
- `finiteBarrierCrossingAssertions.ts:16-42` measures actual snapshot
  semantic geometry, excluding authored room walls, and the barrier regression
  passes with the generated long-run bound. `finiteFloorTopology.test.ts` and
  `finiteFloorGenerationTrace.test.ts` both pass the seed-2, floor-1,
  room-target-300 / room-size-25 / variation-10 best-effort case while retaining
  usable semantic geometry and entrances for admitted rooms.
- `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts:91-143`
  samples the finite snapshot planes and `generationPreviewColors.ts:12-24`
  gives Transition its own visible role. Projection tests pass full-bounds
  fitting, sampled drawing, transition rendering, hover semantics, and
  coordinate round-trips.
- Focused evidence: topology/barrier **2 files / 10 tests passed** in 28.27s;
  high-target trace **1 passed / 9 intentionally excluded by the explicit
  test-name pattern** in 9.54s; preview projection **1 file / 10 tests passed**;
  `npm run lint:working-tree` passed. Only documented legacy folder-size
  notices remain. No broad gates, port `8787`, or agents were used.

No actionable finding remains in this finite-generation recovery slice. Status
remains `in-review` for parent final gates.

### Parent final-gate round — `changes-requested`

- Reviewer: `primary thread`
- Findings: The focused handoff is insufficient against the full gate and the
  latest editor preview. The remaining timeout/semantic failures and the
  long-wall visual defect must be resolved before approval.
- Resolutions: Pending the next Sol coder pass.

## Memory candidates

- Record the verified boundary between test-only finite-floor reuse and the
  runtime authoritative floor lifecycle.
- Test-only prepared floors must validate world seed, floor, void mode, bounds,
  configuration fingerprint, and content fingerprint before reconstruction;
  invalid artifacts fall back to real generation. Promotion remains deferred
  until the remaining directory timeout is resolved.

## Latest bounded recovery checkpoint

This card remains in `02_implementation/` with `Status: in-progress`.

Changes in the latest bounded pass:

- Prediction integration fixtures now align synthetic client floor/readiness
  with the simulation in `tests/integration/predictionSupport.ts` and
  `tests/integration/clockDriftPrediction.test.ts`.
- `packages/client/src/three/client/ThreeSelectedActions.test.ts` now supplies
  the required empty stair-position method on its minimal world double.
- `packages/engine/src/world/generate/finiteFloorTopologyValidation.ts` no
  longer rejects a valid floor solely because best-effort room admission
  retained fewer ordinary rooms than the requested target.
- `packages/engine/src/world/generate/connections/bridges/finiteMazeCrossings.ts`
  adds deterministic width-derived apertures through long unprotected maze
  barriers, retaining distinct-region apertures as connector links.
- `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts`
  adds a derived ordinary-barrier regression, and
  `packages/engine/src/world/generate/finiteFloorTopology.test.ts` adds a
  seeded high-target best-effort regression.

Focused evidence:

- Prediction integration shard: **2 files / 4 tests passed**.
- Three action shard: **2 files / 11 tests passed**.
- Direct Node trace probe for the barrier seed completed in approximately
  **2.2s** and produced 7 snapshots, so no direct engine generation loop was
  reproduced.
- Post-aperture isolated barrier command:
  `timeout 35s npx vitest run
  packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts
  --maxWorkers=1 --reporter=verbose` — **exit 124**, no test result.
  The post-change topology aggregate likewise did not complete.

Remaining blocker: the deterministic barrier-segmentation path is not yet
validated under Vitest despite the direct generation probe completing. Do not
move this card to review or claim the room/barrier acceptance is green until
that focused regression and the affected topology shard complete. No broad
suite or port was run in this checkpoint.

### Immediate bounded checkpoint — 2026-08-03

The requested stop point was reached without starting another command. Exact
evidence currently available:

- The pure/stage barrier shard previously completed with
  `timeout 45s npx vitest run
  packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts
  --maxWorkers=1 --reporter=verbose`: **1 file / 2 tests passed** in about
  **10.81s** after caching the snapshot planes used by the assertion. This
  proves the existing barrier regression can complete, but it is not the
  final post-refactor proof.
- The intended high-room-target regression is **not proven**. The prior
  `--testNamePattern='best-effort room target'` invocation matched no test and
  skipped the file's tests; it must be rerun with the exact test name or moved
  into the trace/preview-focused shard.
- `npm run lint:working-tree` has **not** been rerun after the barrier helper
  extraction. The last lint report still contained barrier-test assertions,
  barrier-segmentation complexity/file-size, and topology-test file-size
  findings.

That earlier checkpoint is superseded by the final bounded handoff below;
the focused acceptance and lint requirements are now complete.

### Final bounded recovery handoff — 2026-08-03

The requested recovery fixes are complete within this card's scope:

- `finiteFloorTopologyValidation.ts` treats ordinary room target count as
  best-effort. Mandatory feature ports, protected routes, connectivity, loops,
  territories, and required walkable-cell validation remain authoritative.
- `finiteMazeBarrierSegmentation.ts` owns the pure width-derived opening
  schedule and deterministic segmentation of long unprotected maze barriers.
  Protected room walls and registered mandatory routes remain excluded by the
  aperture admission predicate. `finiteMazeCrossings.ts` wires the helper into
  maze-fill before final region validation.
- `finiteBarrierCrossingAssertions.ts` caches stage planes once while measuring
  ordinary wall runs, avoiding repeated immutable snapshot getter cloning.
- `finiteFloorGenerationTrace.test.ts` and
  `finiteFloorTopology.test.ts` cover seed `2`, floor `1`, room target `300`,
  room size `25`, and variation request `10`. The generated trace reaches
  `final-validated`, retains fewer rooms than the best-effort request, gives
  every retained room an entrance, and contains walkable semantic cells.
- `generationPreviewProjection.test.ts` verifies transition openings are
  projected with their visible semantic role, alongside the existing stage
  projection and hover/cursor coverage; openings are therefore rendered from
  snapshot planes rather than metadata-only connectors.

Exact focused evidence:

- `timeout 90s npx vitest run packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts --maxWorkers=1 --reporter=verbose` — **2 files / 10 tests passed**, 28.40s. This includes the seeded high-target topology regression and the two barrier tests; the long-wall stage assertion completed in 10.26s.
- `timeout 60s npx vitest run packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --testNamePattern='publishes a usable trace when a high room target is best-effort' --maxWorkers=1 --reporter=verbose` — **1 passed / 9 skipped**, target test 3.39s.
- `timeout 30s npx vitest run packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts --maxWorkers=1 --reporter=verbose` — **1 file / 10 tests passed**, 0.765s.
- `npm run lint:working-tree` — **passed**. Configuration docs passed; only the pre-existing/documented legacy oversized-folder notices remain (`scenes/editor`, `game-server/src`). No full `npm test`, ports, or agents were used.

That earlier handoff is superseded by the strict typecheck correction below;
the same card is being returned to implementation for review of the source
fix.

### Typecheck correction checkpoint — 2026-08-03

The parent typecheck findings were resolved without changing barrier behavior:

- `finiteBarrierCrossingAssertions.ts` now guards the indexed semantic and
  room-wall values after the bounds check, satisfying strict indexed access.
- `finiteMazeCrossings.ts` now passes the coordinate/axis subset to
  `crossingAperture`; the helper no longer requires the unrelated `regionIds`
  field.

Exact post-fix evidence:

- `timeout 120s npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=1 --reporter=verbose` — **3 files / 20 tests passed**, 43.73s.
- `npm run lint:working-tree` — **passed**; only documented legacy folder-size notices remain.
- `npm run typecheck` — **passed** for engine, content, game-server, and client (including client service-worker config).

The card is returned to `agent-workflow/02_implementation/` with
`Status: in-progress` for the narrow compiler correction review. No broad test
gate, port, or agent was used.

### Luna correction re-review — approved

- `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossingAssertions.ts:47-59`
  guards the computed snapshot index before reading the semantic and room-wall
  planes, and rejects undefined indexed values. This is a strict indexed-access
  safety correction only; the ordinary-barrier predicate is unchanged.
- `packages/engine/src/world/generate/connections/bridges/finiteMazeCrossings.ts:118-146`
  narrows `crossingAperture` to the coordinate/axis subset it consumes. Both
  callers retain the same bounded 1–2 tile aperture behavior and protected
  topology policy.
- The focused barrier/topology/trace command passed **3 files / 20 tests** in
  43.87s, including the high-target best-effort trace and barrier regression.
- `npm run typecheck --workspace @dc2d/engine` passed. `npm run
  lint:working-tree` passed; only documented legacy folder-size notices remain.
  No broad gates, port `8787`, or agents were used.

No actionable finding remains in this correction. Status is `in-review` for
the next bounded review stage.
