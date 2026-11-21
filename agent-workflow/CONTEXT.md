# Agent Workflow Context

This directory is the repository's ICM-inspired delegation pipeline. Keep a
large feature or release roadmap in `active/`, then break it into bounded
slice cards. Each slice card moves through the numbered stage folders so every
handoff is visible and independently reviewable.

## Canonical layout

- Master roadmap: `agent-workflow/active/<epic-id>.md`
- Slice cards: `01_plan/`, `02_implementation/`, `03_review/`, and
  `04_finalize/`
- Completed slice: `agent-workflow/archive/YYYY-MM/<slice-id>.md`
- Blank task artifact: [`_templates/task.md`](_templates/task.md)
- Stage contracts: `01_plan/`, `02_implementation/`, `03_review/`, `04_finalize/`

Create a slice card from the template in `01_plan/` for each bounded handoff.
Move that same file, without copying it, through `02_implementation/`,
`03_review/`, and `04_finalize/`, then into `archive/YYYY-MM/`. A task ID is
`YYYY-MM-DD-<short-kebab-slug>`; append `-2`, `-3`, and so on only on collision.
Do not put status, agent names, model names, branch names, or version labels in
the filename. The master roadmap remains in `active/` until all of its slice
cards are complete.

## Stage flow

Read only the contract for the current stage, then follow its exact input and
human-check boundaries:

1. [`01_plan/CONTEXT.md`](01_plan/CONTEXT.md) creates or refines one bounded
   slice card and links it to the master roadmap.
2. [`02_implementation/CONTEXT.md`](02_implementation/CONTEXT.md) applies the
   approved slice scope and records the implementation handoff.
3. [`03_review/CONTEXT.md`](03_review/CONTEXT.md) checks that slice and records
   findings on the same moving card.
4. [`04_finalize/CONTEXT.md`](04_finalize/CONTEXT.md) is parent-owned: it runs
   the gates appropriate to the slice, archives the card, and updates the
   master roadmap. Separately authorized Git remains parent-owned.

The stable role factory is [`../.codex/agents/CONTEXT.md`](../.codex/agents/CONTEXT.md).
Durable lessons are routed through [`../agent-memory/CONTEXT.md`](../agent-memory/CONTEXT.md).
The master roadmap is the source of overall scope; the current slice card is
the source of handoff scope. Neither requires loading every source, memory, or
archive file.

## Status and ownership

Use exactly one of these values in each slice card's `Status` field:

| Status | Meaning | Owner |
| --- | --- | --- |
| `planned` | Scope and acceptance criteria are ready | Parent |
| `in-progress` | Assigned work is being performed | Assigned coder or auditor |
| `in-review` | A complete handoff is ready for independent review | Reviewer |
| `changes-requested` | Actionable review findings await revision | Original coder |
| `blocked` | A recorded dependency prevents progress | Parent |
| `complete` | Approved and validated; archive immediately | Parent |

Normal slice flow is `01_plan/planned` -> `02_implementation/in-progress` ->
`03_review/in-review` -> `04_finalize/complete`. Review findings move the
card back to `02_implementation/changes-requested`; the original coder
returns it to `in-progress`, resolves every finding, and hands it back to
review. The reviewer runs only the slice's changed-file lint and focused tests,
then either requests changes or moves the clean card to `04_finalize/`. The
parent runs the required final gates on the combined worktree, archives the
card, and updates the master roadmap. A blocked slice stays in its current
stage with a recorded dependency.

## Task artifact

Create a fresh slice card by copying [`_templates/task.md`](_templates/task.md)
into `01_plan/`. Add the master roadmap path and slice ID to its routing fields.
That file is the canonical schema for the title, routing fields, goal, plan,
decisions, handoff, review, and memory-candidate sections. Keep the card
operational: update existing fields instead of appending diary entries, and
record only decisions that affect later work. Timestamps are optional except
when needed to distinguish review rounds or a blocker.

Reviewers use the template's `Review` section for each round. Use `P0` for
release/security blockers, `P1` for serious correctness issues, `P2` for
ordinary defects, and `P3` only for worthwhile low-impact issues. An approved
round uses `Findings: None.` Reviewers list possible durable lessons in
`Memory candidates`; they do not write memory directly.

## Completion and archive

The reviewer confirms the slice acceptance criteria and records focused
validation; it does not complete or archive the card. The parent runs the
repository-wide gates when the combined roadmap is ready, resolves or routes
failures, promotes eligible memory, sets the slice `Status: complete`, and
moves that same card from `04_finalize/` to `archive/YYYY-MM/`. The archived
card is the final slice plan, handoff, review record, and summary. The master
roadmap is archived separately only when every slice is complete. Do not create
stage copies; the one-card lifecycle is `01_plan/` -> `02_implementation/` ->
`03_review/` -> `04_finalize/` -> `archive/`.
