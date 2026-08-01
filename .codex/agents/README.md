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

### Configuration is authoritative

The selected profile's configuration is a hard contract. The parent must use
its configured model, reasoning effort, service tier, and role instructions
verbatim. Never override a profile setting silently. An override is allowed
only when Austin explicitly requests it; disclose the exact override before
launching the agent and record the reason in the active workflow artifact.

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
6. When implementation is ready, the reviewer runs
   `npm run lint:working-tree` and the focused tests named by the artifact. It
   reports only relevant errors/warnings, leaves a clean handoff as
   `Status: in-review`, and never completes or archives the artifact. The
   parent runs the repository-wide `npm run lint`, `npm run typecheck`, and
   `npm test` gates against the combined worktree, routes relevant failures
   back to the original coder, or marks the task complete and archives it. If
   Austin requested a Git handoff, the parent runs it after that final gate,
   then uses `luna-git`; Git results return to the parent.
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
