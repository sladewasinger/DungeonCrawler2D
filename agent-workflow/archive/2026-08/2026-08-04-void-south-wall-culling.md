# Void south-wall culling

- Task: `2026-08-04-void-south-wall-culling`
- Master roadmap: `agent-workflow/active/finite-elevation-visibility.md`
- Date: `2026-08-04 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/client/src/scenes/editor/**; opt-in terrain presentation policy and directly related tests; workflow records`
- Preserve: `Normal runtime rendering, finite generation identity, terrain topology, and unrelated editor/admin work.`

## Goal

In Void editor mode, cull south-facing wall faces at exact Floor→Void directed edges while preserving Floor→Floor walls and stairs/doors/authored-boundary rules across view rotations.

## Plan

- [x] Replace height/nearby-open inference with exact rotated directed-edge occupancy.
- [x] Preserve feature-specific faces and normal runtime mode.
- [x] Add orientation, feature, seed-1/2, and cache regressions.
- [ ] Capture browser proof in the parent-owned visual pass.

## Decisions

- This is editor-preview-only and must not change final floor generation or runtime renderer semantics.
- Model the behavior as an opt-in `open-edges` Void south-face presentation mode; sources without the mode retain the existing floating face contract.
- Apply culling only after the planner resolves the rotated screen-south neighbor as Void, so side Void and Floor→Floor height drops cannot suppress a face.
- Preserve stairs, camera-facing wall doors, and explicitly authored floating/flat boundary behavior before applying the ordinary-edge cull.
- Keep the Void cliff rim while omitting the culled wall face and its wall ambient-occlusion geometry.

## Handoff

- Changed:
  - `EditorTerrainWorld` opts only the standalone editor renderer into `open-edges`; gameplay worlds do not opt in.
  - Terrain source/model plumbing carries the presentation mode without changing terrain generation or occupancy.
  - `terrainPlannerBuild.ts` culls ordinary Floor→Void screen-south wall faces at the exact rotated directed edge while retaining the Void rim, Floor→Floor drops, stairs, camera-facing doors, and authored boundaries.
  - `geometry/walls/southFaceGeometry.ts` now owns directed-edge face construction and presentation policy, keeping the planner build module below the repository line limit.
  - `editorTerrainFloor.ts` owns authoritative generated-floor reads and the editor-only presentation opt-in, keeping `EditorTerrainWorld` focused on edit-overlay behavior and below its effective line limit.
  - The chunk-plan cache key includes the presentation mode, preventing floating runtime plans from being reused by the editor preview.
  - Focused coverage exercises every orientation, feature preservation, explicit boundary rules, default runtime floating faces, generated seeds 1/2, and cache separation.
- Validation:
  - Focused terrain/editor shard: 6 files / 72 tests passed.
  - Client TypeScript checks passed.
  - `npm run lint:working-tree` passed, including changed-folder checks.
- Remaining: independent review, parent-owned browser proof, and the parent-owned final gate.

## Review

### Round 1 — 2026-08-04

Findings:

- **Medium — the required working-tree lint gate fails in two scoped files.**
  `packages/client/src/render/terrain/planning/terrainPlannerBuild.ts` is over
  the 150-line limit, and
  `packages/client/src/scenes/editor/EditorTerrainWorld.ts` is also over the
  150-line limit. The card reports `npm run lint:working-tree` as passing, but
  the independent run fails with both `max-lines` errors. Extract the new
  south-face presentation policy/plumbing into small domain helpers (and keep
  the editor opt-in similarly modular) so the changed files satisfy the
  repository size rule without weakening lint.

Verified behavior:

- `EditorTerrainWorld` is the only production `TerrainWorld` that opts into
  `open-edges`; sources without the property retain the existing `floating`
  default.
- The planner resolves the screen-south world neighbor through the active view
  rotation and culls only an exact Floor-to-Void directed edge. Side Void and
  Floor-to-Floor height drops do not take the cull path.
- Stairs, camera-facing wall doors, explicit floating boundaries, and flat
  boundaries retain their established rules. Culled ordinary edges retain the
  Void cliff rim and omit wall ambient-occlusion geometry.
- The terrain plan cache key includes `voidSouthFaceMode`, separating editor
  open-edge plans from runtime floating plans.
- Generated seeds 1 and 2 expose the editor-only mode and cull an ordinary
  south-facing Void edge without changing generation identity or topology.

Validation:

- Focused terrain/editor shard — 6 files / 72 tests passed.
- Client TypeScript checks passed.
- `npm run lint:working-tree` — failed: two scoped `max-lines` errors in
  `terrainPlannerBuild.ts` and `EditorTerrainWorld.ts`.

Outcome: changes requested; return this card to implementation.

Resolution:

- Extracted the south-face geometry/policy from `terrainPlannerBuild.ts`; the build module is now 80 physical lines and the helper is 112.
- Extracted generated-floor reads and the editor presentation constant from `EditorTerrainWorld.ts`; ESLint now accepts the world module under the configured 150 effective-line limit.
- Placed the wall helper under `geometry/walls/`, preserving the 12-file direct-folder limit.
- Re-ran the focused 6-file / 72-test shard, client TypeScript checks, and `npm run lint:working-tree`; all pass.

### Round 2 — 2026-08-04

Findings:

- None.

Verified behavior:

- The lint-only extraction preserves the exact rotated screen-south neighbor lookup and the existing out-of-bounds admission guard.
- Open-edge culling still applies only to ordinary Floor-to-Void faces; Floor-to-Floor drops, stairs, camera-facing wall doors, explicit floating boundaries, and flat boundaries retain their prior behavior.
- Face construction and wall ambient occlusion remain coupled in the extracted wall-geometry helper, so a culled face cannot leave orphaned wall AO.
- Generated-floor accessors preserve the editor world's prior in-bounds values and out-of-bounds fallbacks, while the `open-edges` opt-in remains editor-only.

Validation:

- Focused terrain/editor shard — 6 files / 72 tests passed.
- Client TypeScript checks passed.
- `npm run lint:working-tree` passed, including the changed-folder check.

Outcome: approved; advance this card to finalization.

## Memory candidates

- None.
