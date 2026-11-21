# Review Stage Context

## Job

Independently review one complete scoped slice, record actionable findings, and
leave the same card ready for parent finalization when clean.

## Working inputs

- `AGENTS.md`
- `agent-workflow/CONTEXT.md`
- `agent-workflow/03_review/<slice-id>.md`
- The complete diff for the paths listed in that artifact's `Scope`
- The validation evidence recorded in the artifact's `Handoff`

## Reference inputs

- `.codex/agents/CONTEXT.md`
- The selected reviewer profile under `.codex/agents/`
- Only the `agent-memory/` category files relevant to the change

## Process

1. Check the implementation against the slice card's acceptance criteria, its
   master-roadmap link, and repository instructions.
2. Run the changed-file lint and focused tests named by the card. Report only
   failures relevant to this slice.
3. Record severity-ordered findings, exact paths, and resolutions in the card's
   `Review` section.
4. If findings remain, move the same card back to
   `02_implementation/` with `Status: changes-requested`; if clean, move it to
   `04_finalize/` with `Status: in-review`.

## Shared artifact

The slice card is the only review record. Do not edit implementation files,
create copies, load unrelated stages, load all memory, or read the whole source
tree by default.

## Human check

Confirm that findings are actionable and relevant, and that approval leaves the
artifact explicitly ready for parent-owned final gates.
