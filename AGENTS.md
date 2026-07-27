# Repository Agent Instructions

## Austin's F-Bomb Counter

For every new user message from Austin, count each case-insensitive use of
“fuck” or a clear derivative such as “fucks,” “fucked,” “fucking,” “fucker,”
“fuckers,” "fucking," “motherfucker,” or “motherfuckers.”

Before finishing that turn, increment both the visible number and the
`f-bomb-count` marker in `README.md` by the number of new occurrences.

Count Austin's new wording only. Do not recount quoted history, attachments,
code, tool output, or the phrases “f word” and “f bomb” when the word itself
does not appear.

## Validation workflow

- During iterative work, run `npm run lint:working-tree`; it lints only changed
  and untracked JavaScript/TypeScript files and checks changed folder sizes.
  Reserve `npm run lint` for the pre-commit/release gate.
- Do not run tests during implementation iterations. Run `npm test` only at the
  final validation checkpoint immediately before committing, unless Austin asks
  for an earlier test run.

## Critical code quality rules

- Write highly modular, decoupled TypeScript.
- Never nest conditionals or loops deeper than 3 levels.
- If a function is approaching 25 lines, immediately abstract sub-steps into
  private, pure helper functions.
- Prefer pure functions with explicit inputs and outputs over stateful,
  side-effect-heavy code to maintain low coupling.
- If an object requires more than 3 parameters, group them into a single,
  cohesive TypeScript interface or type.
