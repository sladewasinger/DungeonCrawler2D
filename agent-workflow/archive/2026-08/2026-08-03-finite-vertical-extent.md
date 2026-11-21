# Finite vertical-extent safety invariant

- Task: `2026-08-03-finite-vertical-extent`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `in-review`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/engine/src/world/generate/terrain/**`, finite terrain
  materialization, and `verticalExtentInvariant.test.ts` only
- Preserve: finite topology, editor/admin, client renderer structure, and
  unrelated dirty worktree changes.

## Goal

Resolve the confirmed one-cell height-2 plateaus for the finite generator
seeds 1, 9, and 17 without weakening the visible wall-cap/cliff safety
contract or hard-coding a production tuning literal into the test.

## Plan

- [x] Reproduce the three finite violations and identify whether the defect is
      in height materialization, cliff repair, or the legacy test contract.
- [x] Implement the smallest behavior-preserving finite safety correction, or
      replace the legacy chunk-local assertion with an equivalent finite-floor
      invariant if that is the authoritative contract.
- [x] Keep the test configuration-independent and prove the reported seeds
      plus representative neighboring finite chunks.
- [x] Record focused evidence and move this same card to `03_review/`.

## Decisions

- Do not exclude the known seeds or simply loosen the invariant.
- The visible cap/rim behavior is the product contract; the test must encode
  that behavior rather than incidental coordinates.
- The reported cells are produced only by the intentional legacy
  `generateChunk()` safe-room kiosk projection, which preserves its height-2
  compatibility contract. Canonical finite runtime slices from
  `finiteFloorForRuntime()` are flat at those cells; the finite generator and
  materialization path do not have a shallow raised plateau defect.
- The invariant now scans canonical finite slices while retaining the same
  independent z+1/depth calculation, so it does not exempt the seeds or loosen
  the safety rule. The existing `generate.test.ts` kiosk assertion remains the
  separate proof of the legacy projection contract.

## Handoff

- Changed: `packages/engine/src/world/generate/terrain/verticalExtentInvariant.test.ts`
  now obtains chunks from the canonical finite floor model and slice path. No
  production terrain/materialization or renderer code changed.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/terrain/verticalExtentInvariant.test.ts packages/engine/src/world/generate/terrain/verticalExtent.test.ts --maxWorkers=1`:
    **2 files / 10 tests passed**.
  - `npx vitest run packages/engine/src/world/generate.test.ts -t
    "safe-room chunks contain an entrance portal" --maxWorkers=1`: **1 passed / 5 skipped**;
    legacy kiosk height-2 compatibility remains intact.
  - `npm run typecheck -w @dc2d/engine`: **passed**.
  - `npx eslint packages/engine/src/world/generate/terrain/verticalExtentInvariant.test.ts packages/engine/src/world/generate/terrain/verticalExtent.ts`: **passed**.
  - `npm run lint:working-tree`: TypeScript ESLint and config-doc checks passed;
    the command remains nonzero only at the unrelated folder-size gate for
    `packages/client/src/admin/map/camera` (13 direct files, no baseline).
- Remaining: Parent-owned unrelated folder-size blocker is unchanged. This
  finite vertical-extent slice is ready for review.

## Review

### Luna review round 1 — approved

- Scope review: approved. The change is limited to the vertical-extent
  invariant test; no finite terrain materialization, renderer structure,
  editor/admin surface, or topology path changed.
- `verticalExtentInvariant.test.ts:9,110-123` now scans the canonical
  `finiteFloorForRuntime()` data through `sliceGeneratedFloorChunk()`, which is
  the runtime `World` contract. The independent scan still derives the same
  `WALL_FACE_MIN_DROP` and z+1 depth rule, retains seeds 1/9/17 and the
  neighboring chunk grid, and treats stair features as intentional ramp/run
  boundaries rather than accepting arbitrary shallow raised floors.
- The legacy compatibility contract remains separate and strict: the kiosk
  assertion still requires `KIOSK_HEIGHT`, the south-facing feature, and the
  existing stair/landing heights in `generate.test.ts:68-99`. No seed was
  excluded, no production/config tuning literal was added, and no assertion
  was loosened to accept both legacy and canonical values.
- Independent evidence: canonical vertical invariant plus focused vertical
  helpers passed 2 files/10 tests; the isolated legacy kiosk assertion passed
  1 test with a 30-second test budget; engine typecheck and scoped ESLint over
  the changed invariant/materialization paths passed. The default 5-second
  legacy invocation was marginally over budget once (5.118s) without an
  assertion failure; this is the known eager-generation runtime budget, not a
  slice failure. The unrelated folder-size warning remains context only.
- No actionable findings remain. Status intentionally remains `in-review` for
  parent gates.

## Finalization

- Finalization gate: canonical finite vertical invariant, focused helper tests,
  legacy kiosk compatibility, engine typecheck, and scoped ESLint all passed;
  the unrelated admin camera folder-size gate remains owned by the final-gates
  card.
- Scope check: only the vertical-extent validation contract changed. Finite
  materialization, topology, renderer, editor/admin, and combat surfaces were
  preserved.
- Status: `complete`

## Memory promotion

- Promoted to `agent-memory/common-code-mistakes/testing.md`: validate finite
  terrain against the canonical immutable floor slice, while keeping legacy
  compatibility projections under their own explicit compatibility test.
