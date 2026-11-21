# Plan Stage Context

## Job

Define or refine one bounded slice of a master roadmap and its acceptance
criteria. This stage does not implement the slice.

## Working inputs

- `AGENTS.md`
- `agent-workflow/CONTEXT.md`
- `agent-workflow/_templates/task.md`
- `agent-workflow/active/<epic-id>.md`
- The current user request and any explicitly named repository paths

## Reference inputs

- `.codex/agents/CONTEXT.md`
- The selected planner profile under `.codex/agents/`
- Only the `agent-memory/` category files relevant to the task

## Process

1. Read the master roadmap and identify one smallest safe write scope that can
   be implemented and reviewed independently.
2. Create a slice card from `_templates/task.md` in `01_plan/`, naming the
   master roadmap and the exact paths it may change.
3. Record preserved paths, decisions, risks, sequenced work, and focused
   validation in that slice card.
4. Stop when the card is inspectable, acceptance criteria are concrete, and the
   human can approve the slice.

## Shared artifact

The new slice card in `01_plan/` is the planning output. Do not edit the
master roadmap beyond linking the slice and its status. Do not create copies in
other stage folders, load unrelated stages, load all memory, or read the whole
source tree by default. On approval, move the same card to
`02_implementation/`.

## Human check

Confirm the scope, preserved paths, and acceptance criteria before implementation
begins.
