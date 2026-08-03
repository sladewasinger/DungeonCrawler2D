# Testing and Validation

Use this file for confirmed recurring mistakes in tests, fixtures, linting,
typechecking, runtime-startup checks, or release validation. Read it when a
change alters validation behavior or when a previous test gave misleading
confidence.

## Do not assert configurable tuning literals

- Mistake: tests asserted a hard-coded production tuning value instead of the
  behavior controlled by configuration.
- Why it failed: changing a documented knob broke the test without changing
  the behavior contract.
- Prevention: build tests around behavioral invariants and fixture-local
  configuration; only assert a configuration value when the value itself is
  the subject of the test.
- Evidence: [finite-dungeon](../../agent-workflow/active/2026-08-01-finite-dungeon.md)
  combat regression notes.
- Last confirmed: 2026-08-03

## Validate the real editor runtime path

- Mistake: focused unit tests and a successful preview projection were treated
  as proof that the local `/editor` page could generate a usable floor.
- Why it failed: browser/runtime failures exposed import errors, stale preview
  state, and coordinate-transform defects that unit-only checks did not cover.
- Prevention: include an explicit-port local browser acceptance pass for the
  editor generation flow, including a successful generation and a failed
  generation that clears the displayed result.
- Evidence: [generation-preview-acceptance](../../agent-workflow/01_plan/2026-08-03-generation-preview-acceptance.md)
  acceptance criteria.
- Last confirmed: 2026-08-03

## Keep canonical and compatibility validation separate

- Mistake: applied a legacy compatibility projection's geometry invariant to
  canonical finite terrain and treated its intentional kiosk geometry as a
  finite-floor defect.
- Why it failed: `generateChunk()` preserves a safe-room kiosk projection,
  while runtime finite terrain is sourced from the immutable finite floor
  slice; the two contracts legitimately differ.
- Prevention: validate canonical finite terrain through its canonical slice and
  keep explicit legacy compatibility assertions for compatibility projections.
- Evidence: [finite vertical extent](../../agent-workflow/archive/2026-08/2026-08-03-finite-vertical-extent.md)
  review.
- Last confirmed: 2026-08-03

## Validate live terrain roots separately from editor previews

- Mistake: treated a successful `/editor` generation preview as proof that
  live Phaser terrain chunk roots rendered correctly after traversal.
- Why it failed: the editor preview and live normal-atlas renderer exercise
  different presentation paths, fallback-root behavior, and directional chunk
  reloads.
- Prevention: use an isolated-port browser run against the live game, traverse
  at least two distinct territories north/south, and verify materials, bedrock,
  exposed rims, retained mesh keys, fallback visibility, and page/console/
  request errors.
- Evidence: [normal-atlas terrain acceptance](../../agent-workflow/archive/2026-08/2026-08-03-terrain-live-visual-acceptance.md)
  review.
- Last confirmed: 2026-08-03

Add entries using the schema in [`../CONTEXT.md`](../CONTEXT.md). Keep test output
and temporary investigation notes in the task artifact, not in durable memory.
