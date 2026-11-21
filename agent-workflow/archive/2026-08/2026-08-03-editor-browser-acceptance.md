# Standalone editor browser acceptance

- Task: `2026-08-03-editor-browser-acceptance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `primary thread with Sol review support`
- Scope: standalone `/editor` generation-preview route, existing Playwright
  screenshot harness, and acceptance evidence only; no product behavior
  changes unless the browser gate exposes a confirmed defect
- Preserve: `/admin` operational separation, engine generation, runtime
  performance fixes, and unrelated dirty worktree changes.

## Goal

Verify the actual localhost `/editor` flow rather than relying only on unit
tests: boot the route on an explicit isolated client port, generate a finite
floor, advance through all preview stages, hover a feature marker for semantic
metadata, confirm failure clears a prior result, and capture a screenshot or
equivalent artifact for the handoff.

## Plan

- [x] Start only the required local services on explicit non-8787 ports.
- [x] Exercise successful generation, stage navigation, hover, and map/editor
      separation in a real browser.
- [x] Exercise a failed generation after a success and verify no stale preview
      remains.
- [x] Record page errors, timings, screenshot/artifact paths, and hand off to
      review without claiming server deployment behavior.

## Decisions

- `/editor` is localhost-only and does not require authentication.
- This card is acceptance evidence, not permission to return preview or entity
  spawning to `/admin`.

## Handoff

- Changed: None; this was an acceptance-only browser run.
- Browser evidence:
  - Client Vite ran on isolated port `5190`; no game server was required and
    port `8787` was not used or touched.
  - `/editor?seed=1` loaded with no page errors, console errors, or failed
    requests.
  - Generate reached `Ready · Stage 1/7 · Mandatory features and safe routes`.
    The first next-stage action reached `Stage 2/7 · Ordinary rooms and wall
    envelopes`; five additional next-stage actions reached Stage 7/7.
  - Final-stage marker hover returned `Mini-boss arena · cell -113, -81`.
  - After success, a browser-only preview-worker fault produced `Generation
    failed — no usable preview. forced browser acceptance failure`; the first
    canvas pixel was `[0, 0, 0, 0]`, proving the prior preview was cleared.
  - Run time was approximately 6.2 seconds. Screenshot evidence is at
    `/tmp/editor-generation-preview-success.png`.
- Remaining: Parent-owned finalization and archive; no slice review findings.

## Review

### Sol scope review — accepted

- The isolated browser evidence covers the requested acceptance matrix:
  `/editor` loaded on client port `5190`; Generate reached Stage 1/7;
  Next advanced through Stage 2/7 and then Stage 7/7; final-stage hover
  returned the semantic mini-boss arena label and coordinates; the forced
  post-success failure cleared the prior preview and reported the explicit
  no-usable-preview state; and the success screenshot is recorded at
  `/tmp/editor-generation-preview-success.png`.
- The run records zero page errors, console errors, and failed requests, and
  explicitly records that port `8787` was not used. No source changes are
  required for this acceptance-only card.
- Findings: None. The card is ready for parent-owned finalization.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Parent scope check: passed; this acceptance-only card changed no source
  files and preserved the authenticated `/admin` operational surface.
- Runtime cleanup: the isolated Vite server on port `5190` was stopped after
  the browser run; port `8787` was not used.
- Finalization disposition: archived after Sol scope review and successful
  browser evidence. Full repository gates and the final Sol audit remain
  parent-owned roadmap work.
