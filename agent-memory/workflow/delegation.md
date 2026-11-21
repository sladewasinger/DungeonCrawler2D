# Planning and Delegation

Use this file for durable lessons about agent plans, handoffs, review routing,
shared artifacts, model selection, and parent-owned orchestration. Read it when
changing the agent workflow or diagnosing unnecessary delegation/context churn.

## Use moving slice cards, not copied handoffs

- Mistake: treating one large active plan as the only handoff caused progress
  and review state to become ambiguous.
- Why it failed: implementation, review, and finalization ownership were not
  visible at the bounded-task level.
- Prevention: keep one master roadmap in `active/`, create bounded cards in
  `01_plan/`, and move the same card through `02_implementation/`,
  `03_review/`, and `04_finalize/` before archiving it.
- Evidence: [finite-dungeon](../../agent-workflow/active/2026-08-01-finite-dungeon.md)
  slice workflow.
- Last confirmed: 2026-08-03

## Keep validation servers isolated

- Mistake: delegated runtime checks reused the development server port.
- Why it failed: repeated `EADDRINUSE` errors prevented the human's local
  server and admin/editor checks from starting reliably.
- Prevention: every delegated or automated runtime check must use an explicit
  isolated port and must not bind the development port `8787`.
- Evidence: [finite-dungeon](../../agent-workflow/active/2026-08-01-finite-dungeon.md)
  runtime-validation decisions.
- Last confirmed: 2026-08-03

## Keep stage metadata synchronized

- Mistake: a slice card was physically moved into `03_review/` while its
  `Status` and the master roadmap still identified it as implementation work.
- Why it failed: the directory layout suggested review was ready, but the
  written handoff state was stale and could route the next agent incorrectly.
- Prevention: after every moving-card transition, verify the card path, its
  `Status`, and the matching master-roadmap link as one atomic metadata update.
- Evidence: [finite-dungeon](../../agent-workflow/active/2026-08-01-finite-dungeon.md)
  slice workflow and the cold-transition/fixture handoffs.
- Last confirmed: 2026-08-03

Add entries using the schema in [`../CONTEXT.md`](../CONTEXT.md). Do not turn this
file into a transcript of an individual task or agent conversation.
