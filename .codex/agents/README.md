# Dungeon Crawler Agent Profiles

These project-scoped Codex profiles are the canonical role definitions for
delegated repository work. Each profile pins its model and disables subagent
tools, so only the parent agent can orchestrate the workflow.

## Model and role policy

| Profile | Default use | Model policy |
| --- | --- | --- |
| `sol-planner` | Plans and workflow architecture | Use Sol |
| `sol-auditor` | Plan, architecture, and workflow audits | Use Sol |
| `luna-coder` | Scoped implementation | Prefer Luna |
| `luna-reviewer` | Independent implementation review | Prefer Luna |
| `luna-git` | Explicitly approved Git handoffs | Use Luna |
| `spark-coder` | Explicitly requested implementation exception | Never an automatic fallback |

The parent must launch the named profile with its configured model. If that
model is unavailable, stop and ask Austin what to use; never retry with a
different model or generic built-in agent. In particular, do not route coding
to Sol or code review to Terra, and do not treat Spark as a Luna substitute.

## Parent-owned lifecycle

1. Inspect repository instructions and the dirty worktree. Record preserved
   paths and give concurrent writers disjoint scopes.
2. Choose a task ID using `agent-workflow/README.md`. For delegated
   implementation, have `sol-planner` create the one active artifact unless
   Austin explicitly waives planning.
3. Assign one original coder to each coherent write scope and record its profile
   and thread identifier in the artifact. Use `luna-coder` unless Austin chose
   another profile.
4. Keep the original coder available while `luna-reviewer` independently
   reviews the complete diff. The coder and reviewer update the same artifact;
   neither creates stage-specific copies.
5. When review requests changes, notify the original coder with the artifact
   path and reuse or resume that thread. Do not relay the findings as a new
   summary. Reuse the same reviewer for the next round when practical.
6. After approval, the parent verifies acceptance criteria and task validation,
   promotes only durable memory, marks the task complete, and archives the
   artifact. If Austin requested a Git handoff, run the pre-commit validation
   required by `AGENTS.md` on that final tree, then use `luna-git`. Git results
   return to the parent; they do not mutate the archived artifact.
7. Close planner threads after planning and close coder/reviewer threads at a
   terminal state. Do not wait on completed or closed threads, reuse a thread
   for unrelated work, or leave agents running after completion. If a blocked
   task is resumed after its thread is gone, a new agent continues from the
   shared artifact.

The parent owns user communication, status transitions that cross role
boundaries, conflict prevention, and the final result. Subagents never spawn,
steer, wait for, or close other agents, and agents must not edit the same
implementation scope concurrently.

## Validation ownership

- The coder records task-specific checks and runs `npm run lint:working-tree`
  near its review handoff when code changed.
- The reviewer checks the diff and recorded evidence. It runs an additional
  non-mutating check only when needed to verify a finding; it does not repeat
  the coder's entire validation by default.
- The parent owns the final gate. Follow `AGENTS.md`: no full test suite during
  implementation iterations, and `npm test` only at the final pre-commit
  checkpoint unless Austin requests it earlier.

See `agent-workflow/README.md` for task state and handoff fields, and
`agent-memory/README.md` for evidence-based memory promotion.
