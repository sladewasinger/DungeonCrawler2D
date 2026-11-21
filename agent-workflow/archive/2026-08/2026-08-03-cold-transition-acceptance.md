# Cold unseen-floor transition acknowledgement

- Task: `2026-08-03-cold-transition-acceptance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/game-server/src/floors/**` transition/preparation paths,
  `packages/client/src/net/connection/**` and `packages/client/src/net/sync/**`
  finite-world transition state, dungeon loading UI, and focused
  cold-transition tests
- Preserve: `Generated-floor topology, editor/admin surfaces, combat, terrain
  material fixes, and unrelated dirty worktree changes.`

## Goal

Make a cold descent to an unseen floor explicit and responsive: accepted
transition acknowledgement must suppress stale movement immediately, keep the
loading/error overlay visible through worker/transfer/decode/install, dedupe
concurrent preparation, and land only after identity validation.

## Plan

- [x] Trace the accepted-descent acknowledgement from server transfer queue to
      client overlay and destination installation.
- [x] Fix any remaining cold-path race without regressing the completed warm
      entry/chunk traversal behavior.
- [x] Add a bounded cold-transition regression with progress, stale-input,
      shared-preparation, and identity assertions.
- [x] Run an explicit-port browser acceptance check and record timings.

## Decisions

- Do not hide cold latency by raising timeouts or removing the loading state.
- Never use or kill port `8787`; browser checks use explicit isolated ports.

## Handoff

- Changed:
  - `packages/client/src/net/connection/connectionState.ts`
  - `packages/client/src/net/connection/welcome.ts`
  - `packages/client/src/net/connection/lifecycle/connectionReset.ts`
  - `packages/client/src/net/sync/applyProgression.ts`
  - `packages/client/src/net/sync/applyTestSupport.ts`
  - `packages/client/src/net/sync/transition/applyFloorTransitionEvent.ts`
  - `packages/client/src/net/sync/transition/applyFloorTransitionAcceptance.test.ts`
  - `packages/game-server/src/floors/preparation/floorPreparationQueue.test.ts`
- Implementation:
  - finite-world load attempts now have a monotonic identity; reconnects,
    newer transitions, and canceled workers cannot install stale floors or
    overwrite a newer loading/error state;
  - superseded transition work is canceled before the next load begins;
  - concurrent transfer requests for one floor retain one preparation promise;
  - existing transition acknowledgement, `canAct` gating, worker/artifact
    identity validation, and loading/error overlay behavior remain in place.
- Review correction:
  - `replaceFloorWorld` now cancels the prior `worldLoadCancel` before
    replacing it with the new runner callback, terminating superseded work.
  - The fake worker retains instances and can emit late resolve/reject events;
    the regression starts two unresolved loads and proves stale callbacks do
    not replace the newer loading state or error.
- Focused validation:
  - `npx vitest run packages/client/src/net/sync/transition/applyFloorTransitionAcceptance.test.ts --maxWorkers=1`: **2 passed**.
  - `npx vitest run packages/client/src/net/sync/apply.test.ts packages/client/src/net/sync/transition/applyFloorTransitionAcceptance.test.ts --maxWorkers=1`: **2 files, 14 passed**.
  - `npm run typecheck -w @dc2d/client`: passed after the correction.
  - Scoped ESLint over the three correction paths: passed.
  - `npm run lint:working-tree`: code/config checks passed; the unchanged
    folder-size blocker remains `packages/client/src/admin/map/camera` (13
    direct files, limit 12), with the existing legacy notices above.
  - `npx vitest run packages/client/src/net/sync/transition/applyFloorTransitionAcceptance.test.ts packages/game-server/src/floors/preparation/floorPreparationQueue.test.ts --maxWorkers=1`: **2 files, 3 tests passed**.
  - Focused client/server transition batch: **7 files, 19 tests passed**;
    11 tests were excluded by the explicit name filter.
  - `npm run typecheck -w @dc2d/client`: passed.
  - `npm run typecheck -w @dc2d/game-server`: passed.
  - Scoped ESLint over all changed slice paths: passed.
  - `npm run lint:working-tree`: code lint and configuration-doc checks passed;
    the folder-size gate remains blocked by unrelated pre-existing
    `packages/client/src/admin/map/camera` at 13 direct files (limit 12).
- Browser acceptance:
  - Fresh isolated servers: client `5189`, game server `8899`; `8787` was not
    used or touched.
  - Playwright URL: `http://localhost:5189/?server=ws://localhost:8899`.
  - Immediate `/tp 82 133` plus `E` descent: `Loading dungeon…` was visible
    at 600 ms after descent, cleared by the 2.1 s sample, Floor 2 arrival
    messages appeared, and page/console errors were empty.
- Remaining:
  - The unfiltered `floorRegistryArtifact.test.ts` prewarm case still has an
    unrelated finite-topology failure at floor 3 (`required walkable cell
    23,-124 ... region 82`); no generation paths were changed in this slice.

## Review

### Luna review round 1 — changes requested

#### P2 — Snapshot-driven floor replacement does not cancel the superseded runner

- `packages/client/src/net/sync/applyProgression.ts:52-70` increments the load
  attempt and overwrites `conn.worldLoadCancel` for each `replaceFloorWorld`
  call, but does not invoke the existing cancellation callback first. If a
  newer destination snapshot supersedes an unresolved load, the older worker
  remains active and its stale result is only ignored by
  `staleWorldLoad()` (`:103-105`). Its stale rejection path returns before
  disposing that runner (`:96`), so the worker is not guaranteed to terminate.
- This leaves the handoff short of the stated “superseded transition work is
  canceled before the next load begins” contract and can retain unnecessary
  generation work during a cold transition. Cancel the prior runner before
  replacing the callback, and add a regression that issues two unresolved
  destination loads, asserts the first worker is terminated, and covers both
  stale resolve and stale reject paths.

Focused evidence: the required transition/preparation batch passed 2 files/3
tests; adjacent `apply.test.ts` passed 1 file/12 tests; client and game-server
typechecks and scoped ESLint passed. The recorded browser check remains valid:
isolated client `5189` / server `8899`, with port `8787` explicitly unused;
loading was visible at 600 ms, cleared by 2.1 s, and no page/console errors
were recorded. The documented floor-3 topology failure remains unrelated.

### Sol correction round — resolved

- P2 resolved: the superseded runner is canceled before callback replacement,
  and late resolve/reject cleanup is covered by the new two-load regression.
- The same card is returned to `03_review/` for independent review.

### Luna review round 2 — approved

- The prior P2 is resolved at `packages/client/src/net/sync/applyProgression.ts:52-68`:
  the existing load callback is invoked and cleared before the new runner is
  created, so superseded work is terminated rather than only ignored by the
  monotonic attempt check.
- `applyFloorTransitionAcceptance.test.ts` now retains both fake workers,
  asserts the first is terminated while the second remains active, and emits
  late resolve and reject callbacks. The loading state, error state, and
  pending destination remain owned by the newer attempt.
- Full card acceptance review: destination identity is validated when the
  generated floor is installed; `canAct` and input sampling remain gated by
  `worldReady`; loading/error callbacks span worker installation; artifact
  handoff and same-floor preparation deduplication remain covered; no
  production generation or unrelated surface changes are in this slice.
- Independent evidence: bounded transition/apply/preparation run passed 3
  files/16 tests; client and game-server typechecks passed; scoped ESLint over
  the changed transition paths passed. The recorded browser acceptance remains
  valid on isolated client `5189` / server `8899`, with `8787` unused: loading
  appeared at 600 ms, cleared by 2.1 s, Floor 2 arrived, and page/console
  errors were empty. The documented floor-3 topology and admin folder-size
  failures remain unrelated context.
- No actionable findings remain. Status intentionally remains `in-review` for
  parent gates.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Parent scope check: passed after the card scope was amended to include the
  `net/sync` transition paths changed by the implementation.
- Finalization disposition: archived after Luna approval, focused tests,
  typechecks, scoped lint, and isolated-port browser evidence. Full repository
  gates remain reserved for the final checkpoint.
