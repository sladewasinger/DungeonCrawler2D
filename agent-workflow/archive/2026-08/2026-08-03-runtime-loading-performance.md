# Runtime loading and finite-floor performance

- Task: `2026-08-03-runtime-loading-performance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/client/src/render/terrain/streaming/**`,
  `packages/client/src/render/terrain/runtime/**`, the finite-world worker
  request coordinator, and corresponding finite-floor loading/runtime tests
- Preserve: `The standalone /editor route, /admin operational surface,
  generation semantics, and unrelated dirty worktree changes.`

## Goal

Restore responsive play after finite-floor startup and chunk traversal. The
initial generation may be expensive, but entering the dungeon and crossing a
new chunk must not replay the whole floor, block input for seconds, or render
the infinite outside area. The player needs an explicit loading fallback while
the client is preparing its deterministic floor view.

## Plan

- [x] Profile the client paths: the terrain cache admitted direct requests for
      wholly outside finite chunks, the finite-world runner did not coalesce
      overlapping requests safely, and the loading overlay assumed its callback
      had run before mount.
- [x] Make the smallest runtime/streaming correction that reuses completed
      work, rejects outside chunks before planning/cache admission, and keeps
      the loading fallback visible through the mount race.
- [x] Add focused cache/coalescing/loading-state regressions. The existing
      isolated browser evidence on client `5189` and game-server `8899` remains
      valid; no new server was started and port `8787` was untouched.
- [x] Record scoped validation and hand off to review.

## Decisions

- Never bind or terminate the development server port `8787` during checks.
- Do not weaken correctness checks or hide latency by increasing test/browser
  timeouts.

## Handoff

- Changed:
  - `packages/client/src/render/terrain/planning/chunkCache.ts`
  - `packages/client/src/render/terrain/planning/finiteChunkAdmission.ts`
  - `packages/client/src/render/terrain/planning/fixtures/devWorldChunkFixture.ts`
  - `packages/client/src/render/terrain/tests/chunkCacheSurface.test.ts`
  - `packages/client/src/render/terrain/planning/terrainPlannerDevWorld.test.ts`
  - `packages/client/src/net/connection/finiteWorld/finiteWorldRunner.ts`
  - `packages/client/src/net/connection/finiteWorld/finiteWorldRunner.test.ts`
  - `packages/client/src/scenes/dungeon/loading/worldLoadingOverlay.ts`
  - `packages/client/src/scenes/dungeon/loading/worldLoadingOverlay.test.ts`
- Implementation:
  - finite chunk admission now filters both visible-coordinate enumeration
    and direct cache access; wholly outside chunks return an empty plan without
    growing the cache or asking the finite world for terrain.
  - identical overlapping finite-world requests share one worker job keyed by
    the complete request, including the exact authoritative artifact payload;
    generated and artifact-backed requests cannot coalesce. Each caller has a
    separate subscription promise, so canceling one caller rejects only that
    caller while the other subscriber can still receive the completed floor.
    Artifact-bearing requests remain uncached across completed requests.
  - the loading overlay derives its initial state from the connection when it
    mounts, preserving loading and error presentation if the callback happened
    before the overlay was installed.
- Validation:
  - `npx vitest run packages/client/src/render/terrain/tests/chunkCacheSurface.test.ts packages/client/src/render/terrain/tests/chunkCache.test.ts packages/client/src/render/terrain/streaming/streaming.test.ts packages/client/src/net/connection/finiteWorld/finiteWorldRunner.test.ts packages/client/src/scenes/dungeon/loading/worldLoadingOverlay.test.ts --maxWorkers=1`: **5 files, 40 tests passed**.
  - `npm run typecheck -w @dc2d/client`: passed for the client and service-worker TypeScript projects.
  - changed-slice `npx eslint` over the runtime coordinator, terrain planning,
    moved fixture, and loading paths: passed.
  - `packages/client/src/render/terrain/planning` now has **12 direct source
    files**; the dev-world fixture is under `planning/fixtures/`.
  - `node scripts/check-folder-size.mjs --changed` still reports only the
    unrelated pre-existing `packages/client/src/admin/map/camera` overflow;
    legacy oversized-folder notices remain baseline warnings.
  - A supplemental run including `terrainPlannerDevWorld.test.ts` produced
    1 file / 3 tests with 2 legacy expected-row failures (VOID and finite
    generated-chunk fixture output). The fixture import itself typechecks and
    the generation assertions were unchanged; this known engine-generation
    migration issue is outside this client runtime slice.
  - Review browser gate used only isolated client port `5189` and game-server
    port `8899`; port `8787` was not used or touched. Warm entry reached
    `worldReady` with no page errors. North and south finite debug teleports
    settled at `(-125,-125)` and `(380,380)` with renderer cache counts `2`,
    `3`, and `4` across warm/north/south (below the configured 32-plan cap),
    and no page errors.
- Review gate completed on isolated ports; the browser evidence is recorded
  below. All three review findings are resolved in this implementation pass.

## Review

Status: `in-review`.

Review round 1 — all three findings resolved:

- Artifact identity is part of the in-flight key and generated/artifact overlap
  has a two-worker regression.
- Coalesced jobs use per-caller subscriptions; cancellation of one subscriber
  leaves the other subscriber live and tested.
- The planning fixture moved to `planning/fixtures/`, bringing direct source
  files from 13 to 12.

The isolated browser gate remains the prior passing evidence on ports 5189/8899:
warm entry reached `worldReady` with no page errors; north/south positions
`(-125,-125)` and `(380,380)` observed cache counts `2`, `3`, and `4`, below the
configured 32-plan cap. Port 8787 was not used or touched.

Review round 2 — approved.

- `finiteWorldRunner.ts:60-67,157-164` includes the exact artifact payload in
  the in-flight identity; `finiteWorldRunner.test.ts:94-113` proves generated
  and artifact-backed overlap posts two worker jobs and returns each result to
  the correct caller.
- `finiteWorldRunner.ts:95-103,136-141` maintains distinct subscriptions;
  `finiteWorldRunner.test.ts:115-129` proves cancelling one coalesced caller
  rejects only that caller while the other resolves from the single worker
  job.
- The moved fixture is under
  `packages/client/src/render/terrain/planning/fixtures/`, and the changed
  folder-size check reports the scoped planning folder at 12 direct files;
  only the unrelated admin/map overflow remains.
- Focused Vitest: 5 files, 40 tests passed. Client typecheck and changed-slice
  ESLint passed.

No scoped findings remain. Move this card to `04_finalize` with Status
`in-review`; retain the isolated 5189/8899 browser evidence and do not touch
port 8787.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: finite runtime loading, chunk admission, and request
  coordination slice only; combined repository gates remain parent-owned.
- Final evidence: 5 focused files and 40 tests passed; client typecheck,
  changed-slice ESLint, and assigned planning folder-size checks passed.
- Browser acceptance passed on isolated ports 5189/8899: warm entry reached
  `worldReady`, north/south traversal stayed within the bounded cache, and no
  page errors occurred. Port 8787 was untouched.
- Legacy moved-fixture assertions remain documented as unrelated migration
  failures; they are not claimed as part of this slice's green evidence.
- Master roadmap: runtime performance slice complete; remaining bug and final
  acceptance slices remain active/planned.
