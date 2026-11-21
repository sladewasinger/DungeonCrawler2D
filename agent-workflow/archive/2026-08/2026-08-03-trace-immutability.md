# Immutable generation trace boundary

- Task: `2026-08-03-trace-immutability`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/engine/src/world/generate/trace/**`, finite floor clone/
  artifact boundaries, and focused trace immutability tests
- Preserve: `Runtime generation, client/admin UI, server transfer behavior,
  and unrelated dirty worktree changes.`

## Goal

Make published generation trace snapshots immutable from consumers' point of
view. Mutation attempts against planes, nested metadata, rooms, connectors,
routes, features, and territory labels must not alter retained snapshots,
fingerprints, repeated requests, or the normal trace-free runtime path.

## Plan

- [x] Inspect the current clone/copy boundary and identify mutable typed planes
      and nested metadata escaping the shallow snapshot freeze.
- [x] Implement copy-on-read trace snapshots, frozen trace collections/bounds,
      and recursive metadata isolation without changing runtime generation.
- [x] Add mutation-attempt, byte-determinism, repeated-request, and trace-free
      runtime regressions.
- [x] Record focused validation and hand off to review.

## Decisions

- Keep trace construction out of ordinary runtime generation.
- Prefer copy-on-publish or copy-on-read over pervasive deep-freeze coupling.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.ts`
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts`
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationTraceTestSupport.ts`
- Implementation:
  - published trace planes are retained privately and returned as fresh typed
    array copies on every snapshot read;
  - rooms, connectors, routes, feature stamps, territory layouts, and bounds
    are copied at the publication boundary, so nested mutation attempts cannot
    alter retained snapshots or fingerprints;
  - trace and snapshot collections are frozen, while ordinary runtime floor
    generation does not construct a trace.
- Validation:
  - `npx vitest run packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts --maxWorkers=1`: **1 file, 9 tests passed** (13.79s).
  - `npm run typecheck -w @dc2d/engine`: passed.
  - `npx eslint packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationTraceTestSupport.ts`: passed.
  - `npm run lint:working-tree`: JavaScript/TypeScript lint and config-doc checks passed; folder-size gate remains blocked by the unrelated pre-existing `packages/client/src/admin/map/camera` folder at 13 direct files (limit 12).
- Remaining: none within this slice.

## Review

Status: `in-review`.

The trace publication boundary is ready for review. No client, server, admin,
terrain, enemy, or unrelated generation paths were changed.

Review round 1 — changes requested.

P2 — `packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts:40,171`:
the scoped ESLint handoff is not clean. The nested mutation test at line 40
exceeds the configured complexity limit, and the test file exceeds the
configured max-lines limit (reported at line 171). The trace implementation
itself passes ESLint, and the focused suite/typecheck pass, but split the test
fixture/assertion helpers so the changed two-file scope passes the required
ESLint gate.

Checks completed:

- Focused Vitest: 1 file, 9 tests passed.
- `npm run typecheck -w @dc2d/engine`: passed.
- Scoped ESLint: source path passed; the required two-file command failed on
  the test complexity and max-lines findings above.

Return this card to `02_implementation`; do not treat the trace slice as
finalized until the scoped ESLint command passes.

Review round 2 — P2 resolved.

The mutation assertion setup and byte-serialization helpers are split into
small test-support functions. Nested plane, room-center, route-point, and
territory-label mutation attempts remain covered. The scoped ESLint command
now passes. The working-tree folder-size failure is outside this slice and
was not altered.

Review round 3 — approved.

- `finiteFloorGenerationTraceTestSupport.ts` isolates the mutation assertions
  and serialization helpers; the prior complexity and max-lines failures are
  resolved without weakening the 9 test cases.
- The trace implementation continues to return fresh typed-plane and deeply
  cloned metadata reads, while `finiteFloorForRuntime()` remains trace-free.
- Focused Vitest: 1 file, 9 tests passed.
- `npm run typecheck -w @dc2d/engine` passed.
- Scoped ESLint passed for all three changed trace paths.

No scoped findings remain. Move this card to `04_finalize` with Status
`in-review`.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: immutable generation trace boundary only; combined
  repository gates remain parent-owned.
- Final evidence: trace suite 9/9 passed; engine typecheck and scoped ESLint
  passed after the test-helper refactor.
- Nested mutation isolation, byte determinism, artifact round-trip, and
  trace-free ordinary runtime coverage are retained.
- Master roadmap: trace immutability complete; cold transition, fixture,
  faction, and browser acceptance slices remain planned.
