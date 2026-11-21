# Editor preview typecheck correction

- Task: `2026-08-03-editor-preview-typecheck`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: the exact client typecheck failure in the generation-preview cursor
  call and its focused regression coverage only
- Preserve: editor behavior, admin portal behavior, generation, and unrelated
  dirty worktree changes.

## Goal

Make the client typecheck pass by handling the optional generation-preview
cursor value without changing hover, cursor, or stage-replay behavior.

## Plan

- [x] Reproduce the exact `exactOptionalPropertyTypes` error.
- [x] Apply the smallest domain-correct fix and add or update focused coverage
      if the optional/null distinction is not already covered.
- [x] Run the focused preview tests, client typecheck, and working-tree lint.
- [x] Move this same card through review and finalization.

## Decisions

- Do not weaken TypeScript compiler settings or broaden the target type merely
  to silence the error.
- Preserve the distinction between an absent cursor and an explicit null
  cursor used by the preview renderer.

## Handoff

- Validation: `npm run typecheck -w @dc2d/client` currently fails only at
  `generationPreviewProjection.ts:136` because `input.cursor` may be
  `undefined` while the drawing helper accepts an optional property that does
  not include explicit `undefined`.
- Implementation: `drawGenerationPreview` now omits `cell` when `input.cursor`
  is `undefined`, while preserving an explicit `null` cell and all existing
  cursor behavior.

- Changed: `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts`
  only. The call now conditionally omits the optional `cell` property instead
  of passing a possibly-undefined value.
- Focused tests:
  `npx vitest run packages/client/src/admin/worldEditor/preview/generationPreviewProjection.test.ts packages/client/src/admin/worldEditor/preview/generationPreviewController.test.ts --maxWorkers=1 --reporter=verbose`
  → 2 files / 13 tests passed.
- `npm run typecheck -w @dc2d/client` → passed.
- `npm run lint:working-tree` → passed; only documented legacy folder-size
  warnings remain.

## Review

### Sol review — 2026-08-03

Disposition: approved for finalize with Status `in-review`. No blocking finding.

Approval evidence:

- The correction at
  `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts:136-141`
  conditionally spreads `cell` only when `input.cursor` is not `undefined`.
  Therefore an absent cursor remains an omitted property, explicit `null`
  remains `{ cell: null }`, and a concrete cell remains unchanged. It does not
  weaken the exact-optional type contract.
- `generationPreviewDrawing.ts:53-63` retains the existing renderer semantics:
  omitted and null cursor values draw no marker, while a concrete cursor draws
  the same bright-white marker. No hover mapping, snapshot data, or replay state
  is touched by the correction.
- Stage replay and hover behavior remain intact in
  `generationPreviewController.ts:95-105,113-147`: stage navigation selects the
  next/previous snapshot, redraws with the retained cursor cell, and recomputes
  semantic hover text from that current snapshot. The focused controller test
  at `generationPreviewController.test.ts:75-95` confirms stationary-cursor
  metadata changes from Spawn to Ordinary room after stage navigation.
- Independently reran exactly the card's focused command: **2 files / 13 tests
  passed**, including projection, CSS/content-box mapping, edge behavior,
  concrete cursor rendering, stale/cancelled generation, failed-preview reset,
  and stationary hover replay.
- `npm run typecheck -w @dc2d/client` passed, including both client and service
  worker TypeScript projects.
- `npm run lint:working-tree` passed. Configuration documentation is complete;
  only the three documented legacy oversized-folder notices remain.
- No server was started and no port or browser evidence is involved in this
  type-only correction.

## Memory candidates

- Keep `exactOptionalPropertyTypes` distinctions explicit at rendering helper
  boundaries; avoid passing possibly-undefined properties when omission is the
  intended contract.
