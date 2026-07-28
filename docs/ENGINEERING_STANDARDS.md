# Engineering Standards — non-negotiable

This is the codebase constitution. Every contributor — human or agent — writes
code against these rules. CI enforces what a linter can enforce; review blocks the rest.
"I'll clean it up later" is how large modules become unmaintainable; later never comes.

## Hard limits (lint-enforced, build fails)

| Rule | Limit |
| --- | --- |
| Lines per file (code, excluding blanks/comments) | **≤ 150** |
| Lines per function | **≤ 35** |
| Cyclomatic complexity per function | **≤ 8** |
| Cognitive complexity per function | **≤ 7** |
| Conditional/loop nesting depth | **≤ 3** |
| Function parameters | **≤ 3** |
| Duplicate string threshold | **3 occurrences** |
| `any` (explicit or implicit), non-null `!`, `@ts-ignore`/`@ts-expect-error` | **forbidden** in `packages/engine`; elsewhere needs an inline justification comment |
| Import boundaries | `engine` imports nothing from other packages, no Phaser, no Node APIs. `content` is data + schemas only. `client`, `game-server` import `engine` + `content`; **nobody imports across the other packages** |
| Circular imports | forbidden |
| Skipped/only tests committed | forbidden |

The complexity, size, nesting, parameter, and duplicate-string limits are enforced by
the root flat ESLint configuration. `sonarjs/cognitive-complexity` supplies the
cognitive-complexity check. Narrow, explicitly documented benchmark/test overrides
are allowed only where the fixture itself is the subject of the test; production
modules must meet every limit.

## Critical code quality rules

- Write highly modular, decoupled TypeScript.
- Never nest conditionals or loops deeper than three levels.
- If a function approaches 35 lines, immediately abstract sub-steps into private,
  pure helper functions.
- Keep no more than four statements per line; do not collapse code to evade
  size limits.
- Prefer pure functions with explicit inputs and outputs over stateful,
  side-effect-heavy code to maintain low coupling.
- If an object requires more than three parameters, group them into a single,
  cohesive TypeScript interface or type.

## Structure

- **Every file opens with a one-sentence doc comment** stating what it owns. If you
  can't write that sentence, the file is two files.
- **A subsystem bigger than one file becomes a folder with a facade:** shared state
  type in `state.ts`, sibling modules exporting plain functions taking that state
  first, an `index.ts` facade owning the state instance and orchestration order (a
  tick order must read top-to-bottom in one `step()`). Consumers import the facade,
  never siblings.
- **State lives in one place.** No module-level mutable state. Everything mutable
  hangs off one state object per subsystem, so a function's inputs are its signature.
- **Split along domain seams, not line counts.** If a split forces two files to share
  private details, it was the wrong seam. The 200-line cap tells you *when* to split;
  the domain tells you *where*.
- **New features add modules, not length.** A feature landing as +150 lines to an
  existing file is the drift this document forbids.
- **Feature folders stay narrow.** A folder may contain at most 12 direct source
  files. When a slice needs file 13, split it into subfolders by feature slice;
  do not flatten unrelated modules into one directory. Existing oversized
  folders are recorded in `scripts/folder-size-baseline.json`; the check prevents
  them from growing and rejects any new oversized folder.

## Code style

- **Self-documenting names.** Full words (`projectile`, not `proj`); functions are
  verbs stating outcome (`resolveMeleeSwing`, not `handleAttack`); booleans read as
  predicates (`isAirborne`). If a name needs a comment to explain it, rename it.
- **Comments state constraints code can't show** — why a magic number, what invariant
  a caller must hold, why the obvious approach fails. Never *what* the next line does.
- **No dead code, no TODO-without-issue, no commented-out blocks.**
- **Prefer pure functions.** Side effects live at the edges (transport, rendering,
  storage); everything between takes data and returns data. This is what makes the
  engine testable, predictable, and shareable between client and server.

## Data-driven or it doesn't ship

The engine implements a **closed vocabulary** of effect primitives, tags, behaviors,
and interaction rules. Everything gameplay-visible — statuses, items, enemies, areas,
recipes — is a JSON file in `packages/content`, zod-validated at load with
cross-reference checks. If a feature can be data interpreted by existing primitives,
it **must** be data. Adding a primitive is rare, deliberate, and lands with schema +
validator + tests in one commit. This is the AI-crafting contract: an LLM composes
new content from the same vocabulary, through the same validator — data in, never
code in.

## Boundaries & trust

- **All input crosses a zod schema before touching logic:** every ws message on the
  server (the client is an adversary in PvP), every content file at load, every AI
  proposal at validation. Parse, don't validate-and-cast.
- **The server owns truth.** Clients send intents, render events, and predict only
  their own body. Any code path where a client asserts an outcome is a bug.
- **Determinism is a tested invariant:** identical `(worldSeed, floor, chunkCoord)`
  ⇒ byte-identical chunk geometry, in CI on Linux and locally on Windows. No
  `Math.random`, no `Date.now` inside the engine — seeded RNG and injected clocks only.

## Testing

- Every module lands **with its tests in the same commit** — engine logic headless in
  vitest, protocol flows as in-process server + headless clients, and visuals
  validated with focused render tests plus explicit playtest evidence.
- Tests assert behavior, not implementation: through the public facade, never
  reaching into siblings.
- A red test or type error anywhere fails the task. There is no "mostly done."

## Definition of done (for any task, any agent)

1. During implementation, use `npm run lint:working-tree` for fast feedback.
   At the final validation checkpoint, run `npm run typecheck`, the full
   `npm run lint`, and the production build, then run `npm test` last
   immediately before committing (unless the user asks for an earlier test
   run); all must be green.
2. New behavior has tests; changed behavior has updated tests.
3. Every touched file obeys the hard limits and opens with its doc comment.
4. Gameplay data went into `content/`, not into code.
5. Docs updated when a contract changed (`docs/`, package READMEs).
