# Generation stage deltas

- Task: `2026-08-04-generation-stage-deltas`
- Master roadmap: `agent-workflow/active/finite-elevation-visibility.md`
- Date: `2026-08-04 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/engine/src/world/generate/trace/**; packages/client/src/admin/worldEditor/preview/**; focused tests; workflow records`
- Preserve: `Final generated floor, trace immutability, preview controls, and unrelated work.`

## Goal

Ensure every preview stage represents a distinct generation phase or is merged, and make per-stage native-cell changes observable.

## Plan

- [x] Identify duplicate stage snapshots and merge unconditional duplicates.
- [x] Add stage-delta counts/highlighting for subtle changes.
- [x] Verify seed-1/2 stage progression and focused trace/preview coverage.

## Decisions

- Do not invent visual differences when a stage has no semantic delta.
- Remove the unconditional `room-feature-entrances` snapshot because no operation occurred between it and `maze-fill`.
- Capture `mandatory-backbone` immediately before room placement so `rooms-envelopes` truthfully exposes room, wall, and admitted-entrance cell changes without moving the operation itself.
- Compute deltas across every authoritative typed plane and separately summarize room, connector, route, feature-stamp, and territory-layout metadata.
- Highlight the union of changed cells as a one-pixel-per-floor-cell lime raster, nearest-neighbor scaled through the existing projection; toggling is local and never regenerates the trace.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/finiteFloor.ts` removes the no-op capture and places the mandatory capture on the true pre-room boundary without changing generation order or final output.
  - `packages/engine/src/world/generate/finiteFloorTypes.ts` removes the obsolete stage ID; the trace now contains six real stages.
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationDelta.ts` provides pure authoritative-plane change counts, a native-cell union mask, and separate metadata additions/removals/changes.
  - `packages/engine/src/world/generate/trace/finiteFloorGenerationDelta.test.ts` records seed-1/2 stage order, exact cell counts, nonzero adjacent deltas, native-mask union semantics, and unchanged final fingerprints.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewStage.ts` reports baseline or previous-to-current changed-cell and metadata summaries in stage status.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewPanel.ts` adds the default-on `Highlight changes from previous stage` control and a distinct lime legend role.
  - `packages/client/src/admin/worldEditor/preview/raster/generationPreviewDeltaRaster.ts` builds the native-cell delta raster and scales it without smoothing.
  - Controller/control helpers keep delta toggling local, independent from the protected-route overlay, and free of worker regeneration.
  - Trace test-cache support advances from version 5 to 7 to invalidate both the removed-stage and corrected capture-boundary contracts; finite generator identity is unchanged.
- Stage contract:
  - `mandatory-backbone`
  - `rooms-envelopes` — labeled `Ordinary rooms, wall envelopes, and admitted entrances`
  - `maze-fill`
  - `region-connectivity`
  - `loops-dead-ends-elevation`
  - `final-validated`
- Exact adjacent changed-cell counts:
  - Seed 1: `20,068 / 153,182 / 44,042 / 199,231 / 69,839`.
  - Seed 2: `22,560 / 148,653 / 43,501 / 200,032 / 69,781`.
  - Every retained adjacent pair has a nonzero authoritative-cell or metadata delta; no synthetic visual differences were added.
- Preservation:
  - Seed-1 final floor fingerprint remains `8d0800ed`.
  - Seed-2 final floor fingerprint remains `c40ae6d5`.
  - Trace snapshots remain immutable and final authoritative planes/metadata still equal the returned floor.
- Validation:
  - Engine trace/delta shard — 2 files / 12 tests passed in 18.95s.
  - Focused preview controller/status/raster/projection/replay shard — 6 files / 21 tests passed in 2.00s.
  - Engine and client TypeScript checks passed.
  - `npm run lint:working-tree` passed, including configuration and changed-folder checks.
- Remaining: independent review, browser proof owned by the parent roadmap, and the parent-owned final gate.

## Review

### Round 1 — 2026-08-04

No findings.

Verification:

- Confirmed the obsolete `room-feature-entrances` ID and capture are absent.
  The trace has exactly six stages, with `mandatory-backbone` captured after
  mandatory/territory setup and immediately before room placement, so
  `rooms-envelopes` owns the room, wall-envelope, and admitted-entrance delta
  without changing generation order.
- Independently verified seed-1/2 stage order and adjacent native-cell counts:
  seed 1 is `20,068 / 153,182 / 44,042 / 199,231 / 69,839`; seed 2 is
  `22,560 / 148,653 / 43,501 / 200,032 / 69,781`. Every adjacent retained pair
  has nonzero authoritative-plane or metadata activity.
- The delta helper compares all 12 retained typed planes, marks a cell once in
  the union mask even when several planes change, and reports plane counts plus
  separate added/removed/changed metadata counts for rooms, connectors, routes,
  feature stamps, and territory layouts.
- The client converts each changed native cell to exactly one lime raster pixel
  and draws it with smoothing disabled through the existing floor projection.
  The default-on checkbox supplies no mask for the baseline, remains independent
  of the route overlay, and its change handler redraws the current snapshot
  without submitting another generation job.
- Final floor fingerprints remain `8d0800ed` for seed 1 and `c40ae6d5` for seed
  2. Trace tests confirm deterministic bytes, mutation isolation, independent
  stage planes, and equality between the final snapshot and returned floor.
- The trace artifact cache contract is version 7 while finite generator identity
  remains unchanged, correctly isolating trace-only stage changes.
- `npx vitest run packages/engine/src/world/generate/trace/finiteFloorGenerationTrace.test.ts packages/engine/src/world/generate/trace/finiteFloorGenerationDelta.test.ts --maxWorkers=1 --reporter=verbose` — 2 files / 12 tests passed.
- Focused preview controller/status/raster/projection/replay shard — 6 files / 21 tests passed.
- Engine and client typechecks passed.
- `npm run lint:working-tree` — passed.

Outcome: clean independent review; advance this card to finalize with status
`in-review`.

## Memory candidates

- None.
