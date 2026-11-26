# Repository Agent Instructions

## Austin's F-Bomb Counter

For every new user message from Austin, count each case-insensitive use of
“fuck” or a clear derivative such as “fucks,” “fucked,” “fucking,” “fucker,”
“fuckers,” “motherfucker,” or “motherfuckers.”

Before finishing that turn, increment both the visible number and the
`f-bomb-count` marker in `README.md` by the number of new occurrences.

Count Austin's new wording only. Do not recount quoted history, attachments,
code, tool output, or the phrases “f word” and “f bomb” when the word itself
does not appear.

## Workflow & Documentation

- **Single-agent workflow**: One agent owns investigation, implementation,
  testing, and verification directly. Do not use multi-agent ceremony or task
  workflow folders.
- **Colocated docs**: Architecture and subsystem documentation lives in concise
  `README.md` files next to the code they describe. When changing a subsystem's
  behavior or boundaries, update its nearest `README.md` in the same change.
- **Durable pitfalls**: Record only cross-cutting, confirmed technical gotchas
  in `docs/LESSONS.md`.

## Validation workflow

- During iterative work, run `npm run lint:working-tree` and `npm run ai:loop`
  (fast `<4s` incremental ESLint + folder check + `verify:docs` + related Vitest tests + `.verify-reports/ai-feedback.json`).
  Reserve full `npm run lint`, `npm run verify:content`, and `npm run verify:phase` for pre-commit/phase sign-off gates.
- Do not run the full `npm test` suite during implementation iterations. Run `npm test` at the
  final validation checkpoint immediately before committing, unless Austin asks
  for an earlier test run.
- **Phase-Spec Graduation Rule**: While a phase is `📋` or `🚧`, `docs/phases/phase-<N>-*.md` is the active build & verification contract. Upon passing `npm run verify:phase -- phase-<N>`, update affected colocated `README.md`s with final shipped module names/tuning locations, update `docs/ROADMAP.md`, and keep only concise `REQ-P<N>-*` traceability tables in completed phase docs.

## Critical code quality rules

- Write highly modular, decoupled TypeScript.
- Never nest conditionals or loops deeper than 3 levels.
- If a function is approaching 35 lines, immediately abstract sub-steps into
  private, pure helper functions.
- Prefer pure functions with explicit inputs and outputs over stateful,
  side-effect-heavy code to maintain low coupling.
- If an object requires more than 3 parameters, group them into a single,
  cohesive TypeScript interface or type.
- Keep no more than four statements per line; never collapse whole modules
  onto one line to evade file/function size limits.

## Domain-based names

- Name new or renamed folders, files, functions, variables, exported symbols,
  assets, manifest keys, and other shared identifiers after the feature or
  domain concept they represent.
- Do not bleed branch names, renderer names, version numbers, or temporary
  pipeline labels such as `terrain4` or `phaser4` into those names.
- Keep implementation-specific details scoped to the smallest necessary
  architectural boundary. Preserve an existing external name only when it is
  a compatibility entry point, such as a documented URL query parameter.
