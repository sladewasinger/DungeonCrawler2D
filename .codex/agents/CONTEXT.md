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
2. Choose an epic ID using `agent-workflow/CONTEXT.md`. For delegated work,
   have `sol-planner` maintain the master roadmap in `active/` unless Austin
   explicitly waives planning.
3. Break the roadmap into bounded slice cards in `01_plan/`. Assign the
   profile Austin selected to each coherent write scope and record its profile
   and thread identifier in that slice card. For the current finite-dungeon
   roadmap, that is the persistent Sol coder.
4. Move each approved slice card through `02_implementation/`,
   `03_review/`, and `04_finalize/`; never copy it. Keep the original coder
   available while the reviewer independently checks that slice.
5. When review requests changes, notify the original coder with the slice-card
   path and reuse or resume that thread. Do not relay the findings as a new
   summary. Reuse the same reviewer for the next round when practical.
6. When implementation is ready, the reviewer runs
   `npm run lint:working-tree` and the focused tests named by the slice card. It
   reports only relevant errors/warnings, leaves a clean handoff as
   `Status: in-review`, and never completes or archives the artifact. The
   parent runs the repository-wide `npm run lint`, `npm run typecheck`, and
   `npm test` gates against the combined worktree, routes relevant failures
   back to the original coder, or marks the task complete and archives it. If
   Austin requested a Git handoff, the parent runs it after that final gate,
   then uses `luna-git`; Git results return to the parent.
7. Close short-lived planner/reviewer threads at a terminal state. If Austin
   explicitly designates a persistent coder or auditor, keep that thread open
   and reuse it for later slices in the same roadmap; do not close it between
   tasks. Do not wait on completed or closed threads, reuse a thread for an
   unrelated roadmap, or leave non-designated agents running after completion.
   If a blocked slice is resumed after its thread is gone, a new agent
   continues from the slice card.

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

See `agent-workflow/CONTEXT.md` for task state and handoff fields, and
`agent-memory/CONTEXT.md` for evidence-based memory promotion.
