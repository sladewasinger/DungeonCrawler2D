# Terrain boundary and surface artifacts

- Task: `2026-08-03-terrain-boundary-artifacts`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/client/src/render/terrain/**` surface planning, atlas/batch
  geometry, finite boundary and bedrock/cliff presentation tests
- Preserve: `The standalone /editor route, /admin operational surface, engine
  generation, and unrelated dirty worktree changes.`

## Goal

Remove the runtime surface artifacts seen after traversing between chunks:
floor material must not appear on bedrock or wall tops, finite boundary tiles
must keep their correct bedrock/cliff faces, and the fix must work across all
territory materials rather than only the default maze style.

## Plan

- [x] Trace the surface-role, boundary, and chunk-rebuild inputs that produce
      striped or floor-covered bedrock cells.
- [x] Correct the smallest shared planning/geometry boundary and preserve
      material-role selection for territory floors, walls, void, and bedrock.
- [x] Add behavior-focused regressions for north/south traversal and at least
      two distinct territory materials.
- [x] Record focused validation and hand off to review.

## Decisions

- Do not solve a material-role defect by hiding finite boundaries or replacing
  the normal render engine.
- Do not modify generation until the renderer evidence proves the defect is
  caused by the client surface projection.

## Implementation

The shared boundary defect was that finite-envelope edges were inferred only
through `isInBoundsAt`. That callback intentionally admits legacy room-isolation
cells, so a finite floor edge could query the room/legacy terrain path instead
of becoming an outside neighbor. The resulting plan could omit the white rim
and let a reused presentation path classify the adjacent material incorrectly.

The fix in `cliffGeometry.ts` checks the authoritative `finiteBounds` before
the legacy exception. Every neighbor outside the finite envelope is therefore
an explicit finite boundary for cliff/rim generation, while unbounded and room
worlds retain their previous behavior. `chunkCache.ts` now includes the finite
envelope in its immutable plan key, preventing a plan from one floor rectangle
being reused for a different envelope at the same tile revision.

The retained atlas contract remains role-based: `bedrock` is selected before
territory floor roles, territory wall roles are selected only for wall-face
draws, and the shared atlas's authored slot mapping is unchanged by this
slice. The tests cover both territory wall roles alongside a bedrock cap and
the finite edge case where a legacy room callback claims an outside cell.

## Handoff

- Changed paths:
  - `packages/client/src/render/terrain/geometry/cliffGeometry.ts`
  - `packages/client/src/render/terrain/planning/chunkCache.ts`
  - `packages/client/src/render/terrain/tests/finiteVisualPlan.test.ts`
  - `packages/client/src/render/terrain/tests/chunkCacheSurface.test.ts`
- Focused client validation:
  - `npx vitest run packages/client/src/render/terrain/tests/finiteVisualPlan.test.ts packages/client/src/render/terrain/tests/chunkCacheSurface.test.ts packages/client/src/render/terrain/tests/chunkCache.test.ts packages/client/src/render/terrain/planning/terrainPlanner.test.ts packages/client/src/render/terrain/planning/terrainPlannerVoidMode.test.ts packages/client/src/render/terrain/planning/terrainPlannerVoid.test.ts packages/client/src/render/terrain/planning/tileset.test.ts packages/client/src/render/terrain/planning/tests/sharedAtlas.test.ts packages/client/src/render/terrain/batch/atlasBatch.test.ts packages/client/src/render/terrain/batch/atlasBedrock.test.ts packages/client/src/render/terrain/batch/atlasBatchRoleOrdering.test.ts packages/client/src/render/terrain/geometry/atlasUv.test.ts packages/client/src/render/terrain/geometry/cliffGeometry.test.ts packages/client/src/render/terrain/overlay/cliffRimGeometry.test.ts packages/client/src/render/terrain/overlay/pooling/layerPool.test.ts --maxWorkers=1`: **14 files, 96 tests passed**.
  - `npm run typecheck -w @dc2d/client`: **passed** (client and service-worker
    TypeScript projects).
  - `npx eslint` on the four changed client paths: **passed**.
- No server was started and no port was used.
- Browser screenshot validation was intentionally not run in this slice because
  the card requires no server/port; the prior explicit-port Maze atlas gate is
  evidence for the existing shared-atlas mapping, while a cross-territory live
  screenshot remains a review-stage acceptance check.
- Remaining review check: repeat north/south traversal in two territory
  materials with the normal atlas and inspect the screenshot for no bands,
  correct bedrock caps, and continuous white rims.

## Review

### Luna approval review — 2026-08-03

Status: `in-review`.

Findings: None.

Evidence:

- `packages/client/src/render/terrain/geometry/cliffGeometry.ts:90-105`
  checks the authoritative finite envelope before the legacy
  `isInBoundsAt` exception, and
  `packages/client/src/render/terrain/planning/chunkCache.ts:136-149` includes
  the complete finite envelope in the immutable plan key.
- `packages/client/src/render/terrain/batch/atlasDraws.ts:20-25` gives bedrock
  precedence over territory floor selection. The focused visual-plan tests
  cover the finite rim, bedrock cap/wall geometry, and territory roles; shared
  atlas tests cover all authored territory floor/wall pairs.
- The card’s exact focused command passed: **14 files / 96 tests**.
- `npm run typecheck -w @dc2d/client` passed for both client TypeScript
  projects. Changed-path ESLint passed.
- The assigned terrain folders have no folder-size failure. `npm run
  lint:working-tree` reports only the acknowledged adjacent pre-existing
  `packages/client/src/admin/map/camera` size failure and unrelated legacy
  notices.
- No standalone serverless browser traversal harness exists in this scoped
  client terrain tree. The local directional chunk-reload and cross-material
  checks passed; no server or browser was started.

The terrain-boundary-artifacts slice is ready for parent final gates.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: client terrain boundary/surface slice only; combined
  repository gates remain parent-owned.
- Final evidence: 14 focused files and 96 tests passed; client typecheck,
  changed-path ESLint, and assigned terrain folder-size checks passed.
- Cross-material directional checks passed locally; no server/browser harness
  was available in this slice, so the final combined acceptance still needs a
  real explicit-port browser traversal.
- Master roadmap: terrain boundary slice complete; lighting, performance, and
  remaining finite-dungeon slices remain active/planned.
