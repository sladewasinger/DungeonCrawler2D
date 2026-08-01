# Agent Memory

This directory contains durable, repository-specific lessons for future plans,
implementation, review, and operations. It is a small reference library, not a
task log, review queue, handoff record, or substitute for `AGENTS.md`.

## Retrieval policy

Read this file first, then read only the category file or files relevant to the
assigned task. Do not load every memory file by default. The category files are
intentional context boundaries: keep lessons in the narrowest useful file and
split a file when it becomes difficult to scan.

| Category | Read for |
| --- | --- |
| `bugs/regressions.md` | Confirmed runtime regressions and their prevention checks |
| `common-code-mistakes/typescript.md` | TypeScript architecture, coupling, and clean-code failures |
| `common-code-mistakes/testing.md` | Test, lint, validation, and fixture mistakes |
| `workflow/delegation.md` | Durable lessons about planning, handoffs, and agent coordination |
| `lessons.md` | Legacy catch-all only; do not add new lessons here |

Memory files are organized by stable subject, never by agent name, branch,
task status, model, or date. Workflow state belongs in the shared task artifact
under `agent-workflow/active/` or `agent-workflow/archive/`.

## Promotion policy

Only the parent agent promotes memory at task completion. A reviewer or coder
may record a candidate in the task artifact's `Memory candidates` section, but
must not write directly to this directory.

Promote a candidate only when it is:

- confirmed by repository evidence or a reproducible failure;
- likely to recur in a future task;
- not already covered by `AGENTS.md` or another durable lesson; and
- specific enough to prevent a concrete defect.

Do not record speculation, one-off implementation details, generic advice,
secrets, personal data, raw logs, or a separate file for every review finding.
Update an existing lesson when possible. If a category grows, split it by a
stable domain rather than creating task-specific files.

## Entry format

Use this compact format:

```md
## <Domain>: <short lesson>

- Symptom: <observable failure>
- Cause: <confirmed recurring cause>
- Prevention: <specific check or design rule>
- Evidence: [<task-id>](../agent-workflow/archive/YYYY-MM/<task-id>.md)
- Last confirmed: YYYY-MM-DD
```

When a later change invalidates a lesson, update or remove it in the same task
and preserve the evidence trail in the archived task artifact.
