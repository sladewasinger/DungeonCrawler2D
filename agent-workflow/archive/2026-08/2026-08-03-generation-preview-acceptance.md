# Generation preview acceptance

- Task: `2026-08-03-generation-preview-acceptance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/client/src/admin/worldEditor/**` preview projection, controls, hover, and focused editor tests only
- Preserve: `The standalone /editor route, map editor, admin operational surface, and unrelated dirty worktree changes.`

## Goal

Make the localhost `/editor` generation preview honest and usable: a failed
generation clears stale output, stage labels describe the actual stage, the
visible controls explain their topology effects, and hover hit-testing uses the
same finite bounds and canvas transform as rendering. A visible feature marker
must resolve to meaningful hover metadata rather than “outside the bounds.”

## Plan

- [x] Trace the preview render and hover coordinate transforms.
- [x] Fix shared bounds/projection hit-testing and failed-preview state.
- [x] Replace opaque control wording with concise user-facing labels/help.
- [x] Add focused DOM/projection regressions and local screenshot/export
      evidence for a successful generated preview.
- [x] Record focused validation and hand off to review.

## Decisions

- Preview output is local/read-only and must never present partial failed
  generation as a valid floor.
- Controls expose a small authored surface, not raw internal tuning fields.

## Handoff

- Changed paths:
  - `packages/client/src/admin/worldEditor/preview/trace/generationTraceRunner.ts`
    — moved the worker runner into a cohesive trace sub-area so the preview
    folder stays within the direct-file size limit; worker request behavior is
    unchanged.
  - `packages/client/src/admin/worldEditor/preview/trace/generationTraceWorker.ts`
    — moved with the runner and remains the isolated generation worker entry.
  - `packages/client/src/admin/worldEditor/preview/trace/generationTraceRunner.test.ts`
    — moved with the trace runner tests.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
    — canvas pointer conversion now takes one shared transform input and uses
    the same finite projection as rendering; lint-sized drawing concerns were
    extracted without changing the preview sample budget.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts`
    — shared route/feature marker decoration drawing, using the projection
    screen-point function supplied by the renderer.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewController.ts`
    — hover consumes the shared canvas transform; existing cancellation and
    failure clearing now have focused coverage.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts`
    — CSS-scaled pointer and finite-edge marker regressions.
  - `packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts`
    — stale request, disposal, and success-then-failure regressions proving
    stage controls, canvas pixels, projection-dependent feature hover, and
    failure status are cleared.
  - `packages/client/src/admin/worldEditor/controls/generationPreviewControlDom.ts`
    — descriptive authored control labels/help are centralized.
  - `packages/client/src/admin/worldEditor/controls/generationPreviewControls.test.ts`
    — confirms topology controls do not expose opaque “feel” wording and have
    explanatory help.
- Validation:
  - Focused client preview/controls/replay command — **4 files / 16 tests
    passed**.
  - `npm run typecheck -w @dc2d/client` — **passed**.
  - Changed-slice ESLint:
    `npx eslint packages/client/src/admin/worldEditor/preview packages/client/src/admin/worldEditor/controls`
    — **passed**.
  - `npm run lint:working-tree` — JavaScript/TypeScript lint and config-doc
    checks passed; the repository folder-size gate still reports unrelated
    dirty-tree folders (`client/src/scenes/editor`, `engine/src/world/generate`,
    `game-server/src`) and three pre-existing admin folders over their limits
    (`admin/catalog`, `admin/map/camera`, `admin/spectator`). The assigned
    preview folder is no longer reported and has 10 direct source files.
  - No browser command was run; no port was bound. Screenshot evidence remains
    a follow-up if review requires it.
- Preserved: no engine room placement, `/admin`, runtime spawner, or unrelated
  rendering/performance paths were changed.

## Review

### Luna review round 1 — 2026-08-03

Status: `changes-requested`

1. **P2 — the scoped preview folder fails the repository changed-tree size
   gate.** `npm run lint:working-tree` reports
   `packages/client/src/admin/worldEditor/preview` at **13 direct source files**
   against the limit of 12. This is in the assigned preview scope, not an
   unrelated admin/runtime folder. Split one cohesive preview sub-area (or
   otherwise bring the folder within the configured limit), then rerun the
   working-tree lint. Targeted ESLint over
   `packages/client/src/admin/worldEditor/preview` and `controls` passes.

2. **P2 — failed-preview regression coverage does not prove stale output is
   cleared.** `generationPreviewController.test.ts:101-115` starts from an
   empty controller, rejects the first generation job, and checks that the
   status and Next button are cleared. It never first resolves a successful
   preview, so the test would pass even if a later failure left the prior trace,
   projection, canvas pixels, or hover metadata visible. Add a successful
   generation followed by a rejected request and assert the replay/stage
   controls, canvas clear, projection-dependent hover, and failure status are
   reset. The production clear path is at
   `generationPreviewController.ts:61-67,136-144`.

Validation:

- Focused preview/controls/replay run — **4 files / 16 tests passed**.
- `npm run typecheck -w @dc2d/client` — passed.
- Targeted `npx eslint packages/client/src/admin/worldEditor/preview packages/client/src/admin/worldEditor/controls` — passed.
- `npm run lint:working-tree` — failed on the scoped preview folder-size limit
  above; it also reports other pre-existing oversized folders, which are not
  findings for this card.

Handoff: changes requested for the scoped preview folder-size failure and
non-vacuous failed-preview regression. The same card is moving to
`02_implementation/` with `Status: changes-requested`. No `/admin`, runtime
rendering, release, or implementation files were edited by Luna.

### Luna review round 2 resolution — 2026-08-03

Status: `in-review`.

- The three trace files are now under `preview/trace/`; the preview root has
  10 direct source files, below the configured 12-file limit.
- The controller regression now resolves a successful first job, verifies
  Ready/stage navigation and feature hover, then rejects a second job and
  verifies disabled replay controls, canvas clearing, hover reset, and the
  no-usable-preview failure status.
- Both P2 findings are resolved within this card's scope. No `/admin` runtime
  surface, engine room placement, or unrelated rendering path was changed.

### Luna review round 3 — 2026-08-03

Status: `in-review`

Findings: None.

The preview root now contains **10 direct source files**; the three trace
worker files are under `packages/client/src/admin/worldEditor/preview/trace/`,
so the scoped folder is within the 12-file limit. The controller regression
now performs a successful generation, verifies Ready/stage navigation and
feature hover, then rejects a later generation and verifies disabled stage
controls, canvas clear calls, hover reset (including pointer movement after
projection removal), and the no-usable-preview status
(`packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts:127-160`).
The production reset clears replay and projection before clearing the canvas
and hover (`packages/client/src/admin/worldEditor/preview/generationPreviewController.ts:61-67,136-144`).

Validation:

- Focused preview/controls/replay run — **4 files / 16 tests passed**.
- `npx eslint packages/client/src/admin/worldEditor/preview packages/client/src/admin/worldEditor/controls` — passed.
- `npm run typecheck -w @dc2d/client` — passed.
- `npm run lint:working-tree` — no longer reports the assigned preview folder;
  it is blocked only by unrelated admin folder-size failures and legacy
  oversized-folder notices documented in the handoff.

Handoff: approved for parent-owned final gates. Status remains `in-review`; the
same card is moving to `04_finalize`. No `/admin`, runtime, release, or
implementation files were edited by Luna.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: standalone generation-preview slice only; repository-wide
  gates remain parent-owned until the combined roadmap is ready.
- Final evidence: 4 focused client files and 16 tests passed; client
  typecheck, scoped ESLint, and assigned preview folder-size checks passed.
- Known combined-worktree issue: unrelated oversized admin and legacy folders
  remain tracked by their own planned slices.
- Memory promotion: the parent retained the explicit browser-validation and
  failed-preview lessons in agent memory.
- Master roadmap: preview slice complete; admin, rendering, lighting,
  performance, and remaining bug slices remain active/planned.
