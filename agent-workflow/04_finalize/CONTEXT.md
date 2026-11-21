# Finalize Stage Context

## Job

Finalize an approved slice under parent ownership: run the gates required by
the slice and the current combined roadmap, promote eligible memory, update
the master roadmap, and move the same card from `04_finalize/` to
`archive/YYYY-MM/`. Git work remains separately authorized.

## Working inputs

- `AGENTS.md`
- `agent-workflow/CONTEXT.md`
- `agent-workflow/04_finalize/<slice-id>.md`
- `agent-workflow/active/<epic-id>.md`
- The combined worktree after implementation and review
- Only the changed and preserved paths named by the active artifact

## Reference inputs

- `.codex/agents/CONTEXT.md`
- The relevant finalization instructions in `AGENTS.md`
- Only the `agent-memory/` candidates and category files relevant to the task

## Process

1. Verify the slice card is approved and inspect the combined worktree for
   scope drift against both the card and its master roadmap link.
2. Run the gates required by `AGENTS.md` for the current release checkpoint;
   route relevant failures back to the original implementer through the slice
   card. Do not claim the entire roadmap complete from one clean slice.
3. When clean, update the card, set `Status: complete`, promote eligible
   memory, update the master roadmap's slice checklist, and move the same card
   to the current archive directory.

## Shared artifact

The slice card is the final plan, handoff, review record, and task summary for
that bounded change. Do not create copies. Do not load unrelated stages, all
memory, or the whole source tree by default, and do not perform Git work
without separate authorization.

## Human check

Confirm final-gate evidence, archive destination, and any memory promotion before
authorizing a Git handoff.
