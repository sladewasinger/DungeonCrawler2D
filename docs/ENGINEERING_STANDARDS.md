# Engineering Standards — non-negotiable

This is the constitution of the v2 rebuild. Every contributor — human or agent — writes
code against these rules. CI enforces what a linter can enforce; review blocks the rest.
"I'll clean it up later" is how v1's `sim.ts` reached 1,400 lines; later never comes.

## Hard limits (lint-enforced, build fails)

| Rule | Limit |
| --- | --- |
| Lines per file (code, excluding blanks/comments) | **≤ 200** |
| Lines per function | ≤ 40 |
| Cyclomatic complexity per function | ≤ 10 |
| `any` (explicit or implicit), non-null `!`, `@ts-ignore`/`@ts-expect-error` | **forbidden** in `packages/engine`; elsewhere needs an inline justification comment |
| Import boundaries | `engine` imports nothing from other packages, no Phaser, no Node APIs. `content` is data + schemas only. `client`, `game-server` import `engine` + `content`; **nobody imports across the other packages, and nobody imports `reference/`** |
| Circular imports | forbidden |
| Skipped/only tests committed | forbidden |

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
  vitest, protocol flows as in-process server + headless clients, visuals via
  Playwright against a fixed seed (`e2e-world`) using debug teleport, never by
  wandering.
- Tests assert behavior, not implementation: through the public facade, never
  reaching into siblings.
- A red test or type error anywhere fails the task. There is no "mostly done."

## Definition of done (for any task, any agent)

1. `npm run typecheck`, `npm run lint`, `npm test` all green — run them, don't assume.
2. New behavior has tests; changed behavior has updated tests.
3. Every touched file obeys the hard limits and opens with its doc comment.
4. Gameplay data went into `content/`, not into code.
5. Docs updated when a contract changed (`docs/`, package READMEs).
