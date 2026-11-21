# Finite barrier traversability and preview clarity

- Task: `2026-08-03-finite-barrier-preview`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/generate/**; packages/client/src/admin/worldEditor/preview/**; directly related tests; workflow records`
- Preserve: `All unrelated dirty paths, gameplay systems, admin operational surfaces, release files, and existing fixture migrations.`

## Goal

Eliminate genuine map-spanning unowned movement barriers while making preview openings and route semantics legible.

## Plan

- [x] Diagnose movement at native tile resolution and distinguish real barriers from preview sampling artifacts.
- [x] Repair only genuine unowned full-thickness barriers with deterministic openings; retain protected authored structures.
- [x] Rasterize preview at native cells and separate optional route overlays from structural connections.
- [x] Add seeded movement and preview regressions; validate focused generator/preview shards and lint.

## Decisions

- Selected by Sol planning: do not globally thin walls or blindly cut protected structures.
- The exact reported seed/configuration has no genuine movement partition: runtime movement reports no illegal edges or disconnected non-arena walkable cells, every connector is spawn-reachable, and ordinary one-cell barrier intervals remain within the normalized 32-cell deterministic spacing. The contrasting barrier seed also retains its admitted crossings. No additional generator carving was justified or added.
- The visible mismatch was the preview's 4x4 center-cell reduction plus one gold treatment for Transition cells, connector points, and route polylines. The base preview now uses one source pixel per floor cell and nearest-neighbor scaling.
- Cyan connector points are always visible. Protected routes are a thin violet debug overlay, off by default and toggled locally without regenerating or changing replay, fingerprints, hover mapping, or snapshots.
- The raster cache retains only the currently displayed immutable snapshot source; changing stage/snapshot replaces it.
- Ordinary-barrier assertions iterate local interior coordinates, then translate them through `bounds.minX` and `bounds.minY` before indexing the snapshot. This preserves the intended edge exclusion while covering negative- and positive-origin floors symmetrically.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossingAssertions.ts`
  - `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewColors.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewHover.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewPanel.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts`
  - `packages/client/src/admin/worldEditor/preview/controls/generationPreviewRouteOverlay.ts`
  - `packages/client/src/admin/worldEditor/preview/raster/generationPreviewRaster.ts`
  - `packages/client/src/admin/worldEditor/preview/raster/generationPreviewRaster.test.ts`
  - `packages/client/src/admin/worldEditor/preview/tests/generationPreviewControllerSupport.ts`
  - `agent-workflow/04_finalize/2026-08-03-finite-barrier-preview.md`
- Validation:
  - `npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts --maxWorkers=1 --reporter=verbose` — 2 files / 11 tests passed in 36.63s, including exact reported and contrasting seed movement proofs.
  - `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1` — 5 files / 23 tests passed.
  - `npm run typecheck --workspace=@dc2d/engine` — passed.
  - `npm run typecheck --workspace=@dc2d/client` — passed, including service worker configuration.
  - `npm run lint:working-tree` — passed; only documented baseline folder-size notices remain.
  - Review correction: `npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts --maxWorkers=1 --reporter=verbose` — 1 file / 4 tests passed in 13.39s; the negative-origin regression independently requires the expected ordinary-barrier length on each side of zero.
  - Review correction: `npm run typecheck --workspace=@dc2d/engine` — passed.
  - Review correction: `npm run lint:working-tree` — passed; only documented baseline folder-size notices remain.
  - Isolated Chromium `/editor` acceptance on client port `5191` reached `Stage 7/7 · Final validated floor`; protected routes were off by default, enabling them changed the canvas while retaining the same stage, the legend named Transition cells/connectors/protected routes separately, and no page or console errors occurred. Captures: `/tmp/dc2d-barrier-preview-final-routes-off.png` and `/tmp/dc2d-barrier-preview-final-routes-on.png`.
- Remaining: Parent-owned combined repository gates and integration.

## Review

### Round 1 — `changes-requested`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - `[P2] packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossingAssertions.ts:27 — longestOrdinaryBarrier iterates 1..bounds.width/height and passes those local indices directly to snapshotIndex as world coordinates. Default finite bounds start at (-128,-128), so both orientations omit the entire negative-coordinate portion of the floor while scanning out-of-bounds positive coordinates instead. The reported-seed assertion can therefore pass with an overlong ordinary barrier in the omitted area, leaving the card's full-floor spacing diagnosis incomplete.`
- Resolutions:
  - [P2] Resolved — `isOrdinaryBarrier` now translates local interior coordinates through `bounds.minX`/`bounds.minY` before calling `snapshotIndex`. A negative-origin regression independently asserts ordinary barrier spans on both sides of zero, including the four-cell negative-side span that the prior scanner omitted.
- Verification:
  - Confirmed runtime movement analysis and disconnected-cell checks operate on the full generated bounds; this finding is limited to the ordinary-barrier spacing proof.
  - Confirmed the preview uses one raster pixel per native cell, disables smoothing, keeps cyan connectors visible, and toggles violet protected routes locally without requesting a new trace.
  - Inspected both recorded Chromium captures: each shows Final stage 7/7; the default-off capture retains cyan connectors, the enabled capture adds violet routes without changing stage, and the legend distinguishes Transition cells, connector points, and protected routes. No page error is visible in either capture.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts --maxWorkers=1 --reporter=verbose` — passed 2 files / 11 tests.
  - `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1` — passed 5 files / 23 tests.
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.
  - Coder correction: `npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts --maxWorkers=1 --reporter=verbose` — passed 1 file / 4 tests.
  - Coder correction: engine typecheck and working-tree lint passed.

### Round 2 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Confirmed ordinary-barrier scan positions translate through `bounds.minX` and `bounds.minY`, covering the complete negative- and positive-coordinate interior while preserving edge exclusion.
  - Confirmed the regression independently measures a four-cell negative-coordinate span and a three-cell positive-coordinate span.
  - Confirmed the reported-seed full movement/disconnection checks, native-cell preview semantics, default-off local route overlay, and recorded Chromium evidence remain intact.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts packages/engine/src/world/generate/finiteFloorTopology.test.ts --maxWorkers=1 --reporter=verbose` — passed 2 files / 12 tests.
  - `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1` — passed 5 files / 23 tests.
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.

## Memory candidates

- None.
