# Editor preview hover mapping

- Task: `2026-08-03-editor-preview-hover-mapping`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `in-review`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: standalone `/editor` generation-preview canvas hit testing, hover
  labels, and browser acceptance evidence only
- Preserve: finite generation, admin portal, entity spawner, game renderer,
  import/export, and unrelated dirty worktree changes.

## Goal

Make generation-preview hover coordinates match the displayed trace so brown
feature markers and ordinary cells report the correct feature/structure/path,
and expose a bright white cursor pixel to make coordinate errors immediately
visible.

## Plan

- [x] Reproduce the offset with a known final-stage marker and record canvas,
      CSS, device-pixel, trace, and world coordinates together.
- [x] Verify that hover metadata is resolved from the currently displayed
      stage, not always from the final completed trace.
- [x] Add a bright white cursor marker at the exact mapped preview pixel and
      correct the transform/scale/letterbox calculation at its source.
- [x] Verify marker hover, ordinary-cell hover, edge coordinates, and stage
      navigation in a real browser with no page/console errors.
- [x] Move this same card through review and finalization.

## Decisions

- The marker is diagnostic UI for the local editor preview, not game-world
  content.
- Do not paper over mapping errors by widening hitboxes or returning generic
  labels such as “unoccupied floor.”
- Rendering and hit-testing now share the same feature-marker point helper and
  the same content-box-to-device-pixel transform. Hover metadata is read from
  the replay's currently displayed snapshot, including early-stage fallback
  feature stamps, connector apertures, and route cells.
- The cursor diagnostic is a 2x2 white pixel centered on the mapped cell; it
  is not a hitbox expansion or a second coordinate system.

## Handoff

- Changed:
  - `packages/client/src/admin/worldEditor/preview/generationPreviewHover.ts`
    — current-snapshot feature/connector/path hit testing and shared marker
    point calculation.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts`
    — shared feature marker placement, route alignment, and white cursor
    diagnostic.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
    — content-box/device-pixel transform and object-based drawing boundary.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts`
    — displayed-stage projection/cursor lifecycle and failure-safe redraw.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewStage.ts`
    — bounded stage labels/status formatting.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts`
    — current-stage, CSS transform, edge, and cursor-pixel regressions.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewReplay.test.ts`
    — seven-stage navigation/clamping coverage.

- Focused validation:
  - `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1 --reporter=verbose`
    — 4 files, 17 tests passed in 1.29s.
  - `npm run lint:working-tree` — passed. The folder-size checker reports
    only existing warnings: `packages/client/src/scenes/editor` 13 (baseline
    21), `packages/engine/src/world/generate` 41 (baseline 41), and
    `packages/game-server/src` 13 (baseline 14); no changed-slice lint errors.

- Browser acceptance:
  - Clean standalone `http://localhost:5191/editor` run with Vite on explicit
    client port 5191 and no game server. The preview tab was selected before
    Generate; Generate reached Stage 1/7 and six Next actions reached all
    seven stage labels, ending at `Stage 7/7 · Final validated floor`.
  - Observed labels included ordinary-room/wall, territory structure, route,
    connector, path, and authored feature labels including mini-boss arena,
    safe room, and stairs. A mapped cursor cell sampled `[255,255,255,255]`
    at the white diagnostic pixel and reported the corresponding territory
    structure label.
  - Screenshot: `/tmp/editor-preview-hover-5191.png`.
  - Browser result: page errors `[]`, console errors `[]`, request failures
    `[]`. The Vite process was stopped after the clean run; no 8787 server was
    started or used.

- Remaining: none for this bounded implementation slice; ready for review.
- P2 correction: `generationPreviewController.renderSnapshot()` now refreshes
  hover metadata from the retained cursor cell after every Previous/Next
  redraw, so stationary pointers follow the displayed snapshot without a new
  pointer event.
- Changed `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts`
  and added the stationary-cursor stage-navigation regression in
  `packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts`.
- Added `packages/client/src/admin/worldEditor/preview/tests/generationPreviewControllerSupport.ts`
  to keep the focused controller fixture modular and under the file-size
  limits.
- Focused correction validation:
  - `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1 --reporter=verbose`
    — 4 files, 18 tests passed in 1.34s, including stationary hover refresh
    after stage navigation.
  - `npm run lint:working-tree` — passed; only the existing three legacy
    folder-size warnings remain.
- The prior clean browser acceptance on explicit client port 5191 remains
  valid: stages 1–7, semantic hover labels, white cursor pixel, screenshot
  `/tmp/editor-preview-hover-5191.png`, and page/console/request errors all
  empty. This correction changes controller metadata refresh only, so no new
  server or browser process was required; port 8787 was not used.

## Review

### Sol audit — 2026-08-03

Prior status: `changes-requested`.

Finding:

- **P2 — Stage navigation can leave the hover text describing the previous
  snapshot.** Pointer movement correctly resolves metadata from
  `currentGenerationPreviewSnapshot(this.replay)` at
  `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts:113-123`,
  but `selectPreviousStage()` and `selectNextStage()` only replace replay
  state, redraw, and update buttons at `:95-105`. `renderSnapshot()` at
  `:132-137` draws the current snapshot and retained cursor without
  recomputing `options.hover`. A cursor held over a cell while Next/Previous
  changes the displayed stage therefore keeps the old feature/room/connector/
  path label until another `pointermove` occurs. This contradicts the card's
  current-stage metadata contract even though the projection helper itself is
  correct. Recompute the hover description from `cursorCell` and the new
  current snapshot whenever stage selection changes (or centralize redraw and
  hover refresh), and add a controller regression that places the cursor once,
  changes stages without another pointer event, and observes the label change
  or clear according to the newly displayed snapshot.

Audit evidence:

- Current code inspection confirms shared feature-marker coordinates in
  `generationPreviewHover.ts:23-27,47-50` and
  `generationPreviewDrawing.ts:43-50`; content-box/device-pixel conversion in
  `generationPreviewProjection.ts:87-103`; exact finite-edge rejection in
  `:76-85`; and the 2x2 white cursor draw in
  `generationPreviewDrawing.ts:53-63`.
- Ordinary room/wall, authored feature marker, connector, protected path,
  territory, CSS scaling, bordered content-box, finite edge, and cursor-color
  paths are covered by
  `generationPreviewProjection.test.ts:68-152`. Seven-stage navigation and
  clamping are covered by `generationPreviewReplay.test.ts:16-31`.
- Independently reran the card's focused command:
  `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1 --reporter=verbose`
  — **4 files / 17 tests passed**. The green suite does not exercise a
  stationary cursor across a stage change, so it does not close the finding.
- The supplied isolated-port `5191` Stage 1-7 run, white-pixel sample,
  semantic labels, and zero page/console/request errors remain valid evidence
  for the exercised interactions. They do not state that a cursor remained
  stationary while stage navigation changed the underlying snapshot.

Disposition: move this same card to `agent-workflow/02_implementation/` for the
bounded hover-refresh correction. No source, asset, Git, admin, or other
workflow file was changed by this audit.

### Sol correction — 2026-08-03

Resolved. Stage navigation now redraws and refreshes the current hover label
from the retained cursor cell. The new controller regression moves the cursor
once, advances a stage without another pointer event, and verifies the label
changes from the authored spawn marker to the ordinary room description.

### Sol re-audit — 2026-08-03

Status: `in-review`.

Findings: None.

- The prior P2 is resolved at
  `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts:95-105,132-147`:
  Previous/Next replace the replay index and call `renderSnapshot()`, which
  obtains `currentGenerationPreviewSnapshot(this.replay)`, redraws that exact
  snapshot with the retained `cursorCell`, and refreshes hover text from the
  same snapshot and cell. No pointer event is needed after stage navigation.
- `packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts:75-95`
  proves the interaction through the controller's bound Next button: it emits
  one pointer move, observes the Stage-1 Spawn label, clicks Next without a
  second pointer event, and observes the Stage-2 Ordinary room label. The
  staged fixture changes feature/room metadata between snapshots at
  `packages/client/src/admin/worldEditor/preview/tests/generationPreviewControllerSupport.ts:80-92`,
  so the assertion cannot pass by reusing final-stage or stale metadata.
- Prior mapping paths remain intact: current-snapshot feature, connector,
  protected-path, room/wall, territory, and semantic resolution at
  `generationPreviewHover.ts:11-76`; shared feature-marker point ownership at
  `generationPreviewHover.ts:23-27,47-50` and
  `generationPreviewDrawing.ts:43-50`; finite fit/letterbox and exact edge
  mapping at `generationPreviewProjection.ts:47-85`; CSS content-box to canvas
  device-pixel conversion at `:87-103`; and the 2x2 bright-white cursor at
  `generationPreviewDrawing.ts:53-63`.
- The projection suite still covers ordinary room/wall, authored feature,
  connector, protected path, territory, CSS scaling, bordered content-box,
  finite edge, and white cursor behavior
  (`generationPreviewProjection.test.ts:68-152`). Replay coverage still walks
  and clamps all seven stages (`generationPreviewReplay.test.ts:16-31`).
- Independently reran
  `npx vitest run packages/client/src/admin/worldEditor/preview --maxWorkers=1 --reporter=verbose`:
  **4 files / 18 tests passed**. No broad gate was run.
- The recorded isolated-port `5191` browser evidence remains applicable:
  Stage 1 through Stage 7 navigation, semantic ordinary/feature/connector/path
  labels, `[255,255,255,255]` cursor sampling, screenshot
  `/tmp/editor-preview-hover-5191.png`, and zero page, console, or request
  errors. This re-audit did not start a server or bind a port.

Disposition: approved for parent-owned finalization. Move this same card to
`agent-workflow/04_finalize/` with `Status: in-review`.

## Finalization

- Slice gate: focused preview tests, lint, and isolated-port browser evidence
  passed; stage 1–7 hover behavior is verified against the displayed stage.
- Scope check: editor preview projection/hover only; no admin, game renderer,
  generation algorithm, or entity-spawner behavior changed.
- Status: `complete`

## Memory promotion

- Promoted to `agent-memory/common-code-mistakes/testing.md`: stage-replayed
  canvas hover must refresh from the retained cursor and displayed snapshot,
  and browser evidence must include stationary-cursor stage navigation.
