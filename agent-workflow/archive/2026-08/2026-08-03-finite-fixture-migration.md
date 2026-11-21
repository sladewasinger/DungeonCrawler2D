# Finite renderer fixture migration

- Task: `2026-08-03-finite-fixture-migration`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: moved finite client terrain fixtures and their focused tests under
  `packages/client/src/render/terrain/planning/fixtures/**` plus the two
  stale legacy generated-chunk assertions
- Preserve: `Production generation and rendering, editor/admin surfaces, and
  unrelated tests or dirty worktree changes.`

## Goal

Resolve the two known legacy fixture assertions that still expect the old
generated-chunk rows after finite-floor migration. Tests must assert current
finite behavior or be retired only when their old contract is genuinely gone;
do not hard-code new production tuning values.

## Plan

- [x] Reproduce and classify the two moved-fixture failures.
- [x] Replace stale row/value assumptions with behavior-focused finite cache
      and material assertions.
- [x] Run the focused terrain fixture suite and record the migration evidence.
- [x] Hand off to review with no production-value assertions added.

## Decisions

- A fixture migration is not permission to alter runtime generation to satisfy
  old coordinates.
- Tests should prove behavior and invariants, not configurable literal values.

## Handoff

- Changed:
  - `packages/client/src/render/terrain/planning/fixtures/devWorldChunkFixture.ts`
  - `packages/client/src/render/terrain/planning/terrainPlannerDevWorld.test.ts`
- Implementation:
  - removed the stale full-chunk screenshot row constants and retained only
    semantic fixture helpers for distinct tile/terrain material classes;
  - VOID mode now asserts distinct floor and void materials, while finite mode
    asserts floor/bedrock material presence and retains the existing finite
    plane invariants;
  - no production generation/rendering values or runtime paths changed.
- Validation:
  - `npx vitest run packages/client/src/render/terrain/planning/terrainPlannerDevWorld.test.ts --maxWorkers=1`: **1 file, 3 tests passed**.
  - `npm run typecheck -w @dc2d/client`: passed.
  - Scoped ESLint over both changed fixture paths: passed.
  - Broader planning-directory check: **14 files, 109 tests passed, 1
    unrelated timeout** in `tests/terrainPlannerRoomIsolation.test.ts` at the
    default 5s budget; it was not changed.
- Remaining: none within this fixture-migration slice.

## Review

### Luna review round 1 — approved

- Scope review: approved. The two changed files are limited to semantic fixture
  helpers and the focused terrain-planner test; no production generation or
  rendering path, editor/admin surface, or unrelated dirty-worktree change is
  included.
- The stale generated-chunk row/value assertions are removed. The replacement
  checks cover VOID floor/void material distinction, finite floor/bedrock
  presence, finite plane invariants, and the existing explicit occlusion case;
  no production tuning literal was introduced.
- Evidence independently confirmed: focused Vitest
  `terrainPlannerDevWorld.test.ts` passed 1 file/3 tests; client typecheck
  passed; scoped ESLint passed for both changed paths. The recorded broader
  planning result remains 14 files/109 tests passed with one unrelated timeout
  in unchanged `tests/terrainPlannerRoomIsolation.test.ts`; it is context only.
- No actionable findings remain in this slice. Status intentionally remains
  `in-review` for parent gates.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Parent scope check: passed; changed paths remain within the approved fixture
  migration scope.
- Finalization disposition: archived after Luna approval and recorded focused
  client validation. The broader planning timeout remains unrelated context,
  not a blocker for this slice.
