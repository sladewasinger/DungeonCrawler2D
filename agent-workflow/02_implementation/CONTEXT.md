# Implementation Stage Context

## Job

Apply the approved slice-card scope and record a clear implementation handoff.
Do not broaden the slice without returning it to `01_plan/` for replanning.

## Working inputs

- `AGENTS.md`
- `agent-workflow/CONTEXT.md`
- `agent-workflow/02_implementation/<slice-id>.md`
- The exact source, documentation, or configuration paths listed in that
  artifact's `Scope`
- Any preserved dirty paths listed in that artifact

## Reference inputs

- `.codex/agents/CONTEXT.md`
- The selected coder profile under `.codex/agents/`
- Only the `agent-memory/` category files relevant to the scoped change

## Process

1. Read the slice card and its linked master roadmap. Preserve every path
   outside the slice's write scope.
2. Implement only the checked plan items in the slice card's allowed paths.
3. Update its checklist, decisions, handoff, and status with changed paths and
   task-specific validation.
4. When the implementation handoff is complete, move the same card to
   `03_review/` with `Status: in-review`.

## Shared artifact

The slice card is the handoff surface for this stage. Stop at the recorded
implementation handoff; do not load unrelated stages, all memory, or the whole
source tree, and do not create a copy. If review requests changes, the card
returns to this folder with `Status: changes-requested`.

## Human check

Confirm that every changed path is in scope and that the handoff names any
remaining validation or review work.
