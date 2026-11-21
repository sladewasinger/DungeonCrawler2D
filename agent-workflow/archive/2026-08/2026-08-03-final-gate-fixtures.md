# Final-gate stale fixture repairs

- Task: `2026-08-03-final-gate-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `playerVisual.test.ts; frameInteractionPrompt.test.ts; selfInterpolationWalls.test.ts; populationRooms.test.ts; their nearest existing test-support paths; workflow records`
- Preserve: `All production paths, other tests, worker-pool configuration, and unrelated dirty work.`

## Goal

Repair the four prompt stale fixture/test-double failures from final-gate reproduction without weakening their behavioral assertions.

## Plan

- [x] Restore the missing occlusion mock export and required world-double method.
- [x] Derive wall and loot locations from current authored/generated metadata rather than stale scans.
- [x] Run exact files, their small aggregate, relevant typechecks, and lint.

## Decisions

- This card excludes the four semantic candidates and seven contention-only files.
- Keep the player visual mock explicit: `syncEntityOcclusion` is a current
  collaborator invoked by player chrome and belongs beside the retained
  silhouette/terrain occlusion doubles.
- Bind wall projection to the authored floor-zero Sandbox block at `(44,44)`
  through its west approach `(43,44)`. Assert that the fixture remains
  walkable and exceeds `STEP_UP` before exercising projection behavior.
- Derive population candidates from every chunk overlapped by current generated
  room bounds. This preserves deterministic loot eligibility without depending
  on the obsolete fixed `cy = 4`, `cx = -8..8` scan.

## Handoff

- Changed: `playerVisual.test.ts` restores the occlusion export;
  `frameInteractionPrompt.test.ts` completes the world double;
  `selfInterpolationWalls.test.ts` uses and verifies the explicit authored wall
  approach; `populationRooms.test.ts` supplies one prepared floor and derives
  room-bearing chunk candidates from that floor's metadata. No production file
  changed.
- Validation:
  - Each of the four files passes independently with
    `--maxWorkers=1 --reporter=verbose` (`1 + 3 + 3 + 4 = 11` tests).
  - The four-file single-worker aggregate passes: `4` files, `11` tests,
    `2.28s`.
  - `npm run typecheck --workspace @dc2d/client` passes.
  - `npm run typecheck --workspace @dc2d/engine` passes.
  - `npm run lint:working-tree` passes, including config documentation and
    changed-folder size checks.
- Remaining: Independent review. Parent owns any later bounded 15-file
  aggregate; this card intentionally did not run the full suite.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Scope verification: only the four named test files changed for this card; no
  production or worker-pool path was modified by these repairs.
- Contract verification: the player-visual and frame-prompt doubles expose the
  current collaborators, the interpolation test names and guards its authored
  wall approach before retaining all projection assertions, and the population
  test derives candidate chunks from the supplied floor's room bounds while
  preserving active-center eligibility coverage.
- Validation: the four-file single-worker aggregate passes (`4` files, `11`
  tests, `2.27s`) with `--reporter=verbose`; `npm run lint:working-tree` passes,
  including configuration-documentation and changed-folder checks.
- Findings: none.
- Resolution: ready for parent finalization and the later parent-owned bounded
  15-file aggregate.

## Memory candidates

- None.
