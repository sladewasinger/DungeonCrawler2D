# Protected route overlay clarity

- Task: `2026-08-04-protected-route-overlay`
- Master roadmap: `agent-workflow/active/finite-elevation-visibility.md`
- Date: `2026-08-04 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/generate/**; packages/client/src/admin/worldEditor/preview/**; focused tests; workflow records`
- Preserve: `Generator topology, route semantics, editor controls, and unrelated work.`

## Goal

Render shared protected-route trunks once while retaining clear route coverage and debug semantics for seeds 1 and 2.

## Plan

- [x] Audit every seed-1/2 stage-3 gold Transition component and cyan connector owner against final runtime traversability.
- [x] Repair/reroute any intended corridor that crosses final blocked cells; classify non-intended planning traces explicitly.
- [x] Deduplicate valid shared route edges or render density explicitly without changing protected routes.
- [x] Add seed-1/2 final-surface and preview regression coverage.

## Decisions

- The debug toggle explains visibility, not the asymmetric route clustering.
- Projection spill may be clipped, but a true final blocked intended corridor is a generator invariant failure.
- Seeds 1 and 2 contain no final blocked intended corridor under the exact preview request; retain their deterministic topology and generator identity.
- Treat dense magenta trunks as repeated shared-edge representation: canonicalize undirected cardinal edges and stroke the union once.
- Bound cyan connector glyphs to their owning native cell so a valid connector cannot visually claim neighboring Bedrock.
- Enforce route/connector surface truth in final generation validation; a renderer filter is not accepted as a repair for invalid metadata.
- Final trace snapshots publish the authoritative tile, terrain, feature, feature-ramp, and protection planes plus explicit planning/validated surface state; final preview decorations require that validated state.
- Canonicalize requested target coordinates before routing and replace repaired route metadata by exact sequence or endpoint, appending only a genuinely new repaired connection.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceAudit.ts` measures route/endpoint/cell/edge density and rejects out-of-bounds, non-Floor, Void, blocking-feature, unprotected, unreachable, non-cardinal, or movement-illegal final route surfaces with precise diagnostics.
  - `packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceRules.ts` owns the small shared surface and edge predicates used by the audit.
  - `packages/engine/src/world/generate/finiteFloorValidation.ts` runs the audit after elevation and materialization, reusing the authoritative movement analysis.
  - `packages/engine/src/world/generate/finiteFloor.ts` exports the engine-owned audit for debug/preview consumers without changing finite identity.
  - `packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceAudit.test.ts` records exact seed-1/2 density, reconciles maze-fill Transition and connector intent to final surfaces, and proves a final Bedrock overwrite fails.
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.ts`, `finiteFloorGenerationSnapshot.ts`, and `finiteFloorGenerationSnapshotPlanes.ts` copy, hash, and expose authoritative typed surface planes through immutable trace snapshots with explicit validation state.
  - Trace serialization/cache support includes every authoritative plane and invalidates the prior incomplete trace-cache contract.
  - `packages/engine/src/world/generate/finiteFloorFeatureSet.ts` canonicalizes exact route target coordinates; `finiteFloor.ts` replaces repaired route sequences/endpoints instead of retaining duplicate metadata.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts` draws each unique walkable cardinal route edge once and confines connector markers to their owning cell.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts` now filters final route edges and connector owners through the engine-owned authoritative Floor/non-Void/nonblocking/protected predicate and validated trace state.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts` proves duplicated and reversed shared edges do not accumulate opacity; `generationPreviewSurfaceTruth.test.ts` proves stale final Bedrock metadata is refused while valid metadata is drawn.
- Audit:
  - Pre-resolution baseline, default seed 1: 1,576 routes, 410,496 route points, and 712 final connectors; zero blocked, unprotected, or unreachable route points and zero invalid connector owners.
  - Pre-resolution baseline, default seed 2: 1,732 routes, 475,228 route points, and 790 final connectors; zero blocked, unprotected, or unreachable route points and zero invalid connector owners.
  - Exact preview seed 1 (`roomSizeVariation: 10`): 8,504 maze-fill Transition cells and 574 maze-fill connectors all map to final walkable/reachable surfaces; no connector is dropped. Final density is 840 unique targets/routes/endpoints, 210,624 points, 20,963 unique cells, 209,784 total edges, 20,962 unique edges, 188,822 repeated edges, and zero duplicate endpoints.
  - Exact preview seed 2: 9,228 maze-fill Transition cells and 572 maze-fill connectors all map to final walkable/reachable surfaces; no connector is dropped. Final density is 855 unique targets/routes/endpoints, 232,576 points, 21,875 unique cells, 231,721 total edges, 21,874 unique edges, 209,847 repeated edges, and zero duplicate endpoints.
  - Direction counts remain asymmetric but valid after metadata cleanup: seed 1 east/north/south/west = 77,976/22,422/97,788/11,598; seed 2 = 89,609/13,347/121,217/7,548. Unique cells and edges are unchanged, confirming topology preservation.
  - No generator carve, reroute, semantic relabel, or identity/version change was made because the final-surface audit found no true intended blocked corridor.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceAudit.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 2 tests passed in 24.64s.
  - `npx vitest run packages/engine/src/world/generate/connections/connectivity.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 2 tests passed in 29.16s.
  - `npx vitest run packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 9 tests passed in 0.93s.
  - Engine and client TypeScript checks passed.
  - `npm run lint:working-tree` passed, including configuration and changed-folder checks.
  - Round 1 correction: trace/audit/connectivity shard — 3 files / 14 tests passed in 40.10s.
  - Round 1 correction: preview projection and authoritative surface-truth shard — 2 files / 11 tests passed.
  - Round 1 correction: engine/client typechecks and `npm run lint:working-tree` passed.
- Remaining: independent review, browser proof owned by the parent roadmap, and the parent-owned final gate.

## Review

### Round 1 — 2026-08-04

Findings:

- **High — the preview still cannot enforce final-surface truth and renders
  stale Bedrock route/connector metadata.** The engine audit is correctly run
  after materialization and rejects the final-floor Bedrock overwrite used by
  the focused regression. However, `FloorGenerationSnapshot` and
  `finiteFloorGenerationTrace.ts` still retain only height, semantic,
  room-wall, territory, region, and feature-id planes; they omit authoritative
  `tiles`, `terrain`, `features`, feature face/height, and `protectedCells`.
  Consequently `routeCellWalkable` in
  `generationPreviewDrawing.ts:74-82` still treats `semantic > Solid` as
  walkable, and `drawConnectors` at lines 65-71 draws every connector without
  any final-surface predicate. A direct drawing reproduction supplied a
  Corridor-semantic route and connector whose owner tile was Bedrock; the
  preview drew one route segment and one cyan connector glyph. Extend immutable
  snapshots through cloning, fingerprinting, and serialization with the
  authoritative movement planes, expose final-validation state/diagnostics,
  and make final-stage route and connector rendering use the same authoritative
  surface result. Malformed or stale final snapshots must be refused rather
  than rendered from semantic color.

- **Medium — exact duplicate targets and repair-appended duplicate route
  metadata are measured but not reconciled.** An independent target/endpoint
  comparison for the exact preview requests found seed 1 has 842 requested
  targets but only 840 unique coordinates, while its 1,684 routes contain only
  840 unique route sequences (844 exact duplicate routes). Seed 2 has 857
  targets / 855 unique coordinates and 1,714 routes / 855 unique sequences
  (859 exact duplicates). No target is missing and no endpoint is extra, so
  final reachability is sound, but `repairRequiredRoutes` appends a second
  complete route set even when no repair changes the path, and the two exact
  duplicate target coordinates are retained. The audit reports only aggregate
  duplicate endpoints and therefore does not distinguish duplicate requests,
  repair replacement, or expected shared prefixes. Canonicalize exact target
  coordinates and replace/update repaired route metadata instead of blindly
  appending it, with a target-to-endpoint regression. This is metadata cleanup
  and must preserve the already-verified carve/topology planes.

Verified behavior:

- Seed-1/2 final route and connector surfaces pass the engine-owned audit, and
  the production generator invokes it after elevation/materialization through
  `validateFloorAttempt`.
- Route drawing canonicalizes undirected cardinal edge keys before one stroke,
  so duplicated and reversed edges are emitted once.
- Connector glyph width and height are 0.8 native cells and remain centered
  within their owning cell.
- No route implementation changed generator carving, topology, or generator
  identity in this slice.

Validation:

- `npx vitest run packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceAudit.test.ts packages/engine/src/world/generate/connections/connectivity.test.ts --maxWorkers=1 --reporter=verbose` — 2 files / 4 tests passed.
- `npx vitest run packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 9 tests passed.
- Engine and client typechecks passed.
- `npm run lint:working-tree` — passed.
- Direct stale-snapshot drawing reproduction — `bedrockRouteSegmentsDrawn: 1`,
  `bedrockConnectorGlyphsDrawn: 1`.

Outcome: changes requested; return this card to implementation.

### Round 1 resolution — 2026-08-04

- Added `tiles`, `terrain`, `features`, `featureFaces`, `featureHeight`, and `protectedCells` to every immutable trace snapshot and included them in copying, fingerprinting, byte serialization, trace-cache validation, and final-floor equality checks.
- Added explicit snapshot surface validation state: intermediate snapshots are planning state and successful final snapshots are validated with no diagnostics.
- Final-stage preview route edges and connectors now require validated authoritative Floor, non-Void, nonblocking-feature, protected owners through the engine-owned predicate. A direct Corridor-semantic/Bedrock reproduction draws neither the route nor cyan connector; the equivalent valid Floor snapshot draws both.
- Deduplicated requested targets by integer coordinate before routing. Seed 1 now has 840 targets/routes/unique endpoints and seed 2 has 855, with target-to-endpoint equality and zero duplicate endpoints.
- Repaired route metadata now replaces an exact existing sequence first, then an existing endpoint, and appends only a genuinely new repair. Unique route cells/edges and all carve/topology planes remain unchanged.
- Advanced only the test trace-cache contract from version 4 to 5; finite generator identity remains unchanged because runtime floor planes did not change.

Outcome: both findings resolved; returned to independent review.

### Round 2 — 2026-08-04

No findings.

Verification:

- Reproduced the prior stale-snapshot case with authoritative final planes:
  a Corridor-semantic Bedrock route/connector owner now produces zero route
  strokes and zero cyan connector fills, while the equivalent protected Floor
  surface draws both. Final decoration admission requires validated state plus
  the engine-owned Floor, non-Void, nonblocking-feature, protected predicate.
- Verified that immutable snapshots publish and isolate `tiles`, `terrain`,
  `features`, `featureFaces`, `featureHeight`, and `protectedCells`; include
  those planes and validation state in fingerprints/byte serialization; and
  preserve equality with the returned final floor. The trace artifact cache
  contract is version 5 and validates all authoritative planes before reuse.
- Independently reconciled targets, endpoints, and exact route sequences.
  Default seeds 1/2 now have 786/865 unique targets, routes, endpoints, and
  route sequences respectively. Exact preview seeds 1/2 have 840/855 of each.
  All four audits have zero failures and zero duplicate endpoints.
- Exact preview unique route cells/edges remain 20,963/20,962 for seed 1 and
  21,875/21,874 for seed 2, matching the pre-cleanup geometry and proving that
  target canonicalization plus route replacement changed metadata rather than
  generator carve/topology planes.
- `npx vitest run packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts packages/engine/src/world/generate/connections/validation/protectedRouteSurfaceAudit.test.ts packages/engine/src/world/generate/connections/connectivity.test.ts --maxWorkers=1 --reporter=verbose` — 3 files / 14 tests passed.
- `npx vitest run packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts packages/client/src/admin/worldEditor/preview/generationPreviewSurfaceTruth.test.ts --maxWorkers=1 --reporter=verbose` — 2 files / 11 tests passed.
- Engine and client typechecks passed.
- `npm run lint:working-tree` — passed.

Outcome: clean independent re-review; advance this card to finalize with status
`in-review`.

## Memory candidates

- None.
