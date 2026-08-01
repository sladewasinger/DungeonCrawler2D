# Agent Workflow

Use one shared Markdown artifact for the whole task. Do not copy a plan into
separate planning, implementation, review, or finished files.

## Canonical layout

- Active task: `agent-workflow/active/<task-id>.md`
- Completed task: `agent-workflow/archive/YYYY-MM/<task-id>.md`

Create those directories only when they contain a task. A task ID is
`YYYY-MM-DD-<short-kebab-slug>`; append `-2`, `-3`, and so on only on collision.
Do not put status, agent names, model names, branch names, or version labels in
the filename.

## Status and ownership

Use exactly one of these values in the artifact's `Status` field:

| Status | Meaning | Owner |
| --- | --- | --- |
| `planned` | Scope and acceptance criteria are ready | Parent |
| `in-progress` | Assigned work is being performed | Assigned coder or auditor |
| `in-review` | A complete handoff is ready for independent review | Reviewer |
| `changes-requested` | Actionable review findings await revision | Original coder |
| `blocked` | A recorded dependency prevents progress | Parent |
| `complete` | Approved and validated; archive immediately | Parent |

Normal implementation flow is `planned` -> `in-progress` -> `in-review` ->
`complete`. Review findings change `in-review` to `changes-requested`; the
original coder returns it to `in-progress`, resolves every finding, and hands it
back as `in-review`. A blocked task remains under `active/` until resumed or
explicitly abandoned.

## Minimal artifact schema

```md
# <Task title>

- Task: `<task-id>`
- Status: `planned`
- Parent: `primary thread`
- Coder: `unassigned` <!-- later: <profile> / <thread identifier> -->
- Scope: `<allowed paths or domain>`
- Preserve: `<known dirty or out-of-scope paths, or none>`

## Goal

<Required outcome and acceptance criteria.>

## Plan

- [ ] <Sequenced step>

## Decisions

- None.

## Handoff

- Changed: None.
- Validation: Not run.
- Remaining: Planned work.

## Review

No review rounds.

## Memory candidates

- None.
```

Keep the artifact operational: update existing fields instead of appending
diary entries, and record only decisions that affect later work. Timestamps are
optional except when needed to distinguish review rounds or a blocker.

For a review round, replace `No review rounds` or append:

```md
### Round <n> — `changes-requested` | `approved`

- Reviewer: `<profile> / <thread identifier>`
- Findings:
  - `[P1] path/to/file.ts:42 — actionable problem and impact`
- Resolutions:
  - `[P1] <fix and verification, or pending>`
```

Use `P0` for release/security blockers, `P1` for serious correctness issues,
`P2` for ordinary defects, and `P3` only for worthwhile low-impact issues. An
approved round uses `Findings: None.` Reviewers list possible durable lessons in
`Memory candidates`; they do not write memory directly.

## Completion and archive

The parent confirms approval, acceptance criteria, and required validation;
resolves or explicitly defers every finding; promotes eligible memory; sets
`Status: complete`; and moves the same file to the current `archive/YYYY-MM/`
directory. The archived artifact is the final plan, handoff, review record, and
task summary. Do not create a second completion report.
