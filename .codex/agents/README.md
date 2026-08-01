# Dungeon Crawler Agent Profiles

These repository-owned profiles define the team roles used for this project.
They are deliberately separate from user-level Codex profiles so the role
instructions travel with the repository.

The requested model identifiers are preserved exactly. A launcher must verify
that each is available before starting work; it must not replace a missing
model with another model without Austin's approval.

## Roles

| Profile | Responsibility |
| --- | --- |
| `luna-reviewer.config.toml` | Independent code review and verification findings |
| `luna-coder.config.toml` | Scoped implementation work |
| `spark-coder.config.toml` | Scoped implementation work |
| `luna-git.config.toml` | Commits, pushes, and other requested Git handoffs |
| `sol-planner.config.toml` | Planning and coder handoffs only; never edits code |

Each file is a Codex configuration overlay. To use one with a Codex surface
that only accepts user-level profiles, layer its contents into the invocation
or copy it to the appropriate Codex profile location; keep this directory as
the canonical, committed source.

## Delegation workflow

1. Inspect the handoff, current worktree, and repository instructions before
   delegating. Preserve existing dirty files and identify disjoint write scopes.
2. Make a short plan, then delegate bounded implementation work to Spark when
   the exact configured Spark model is available. Use the exact model from the
   selected profile; never substitute an unavailable model silently.
3. Keep one implementation agent responsible for a coherent change. When
   review findings return, send them to that same still-available agent with
   `send_input` so it retains the implementation context. Resume it when it
   was closed; spawn a new agent only when the original cannot be reused or
   the correction is genuinely independent.
   Implementation agents do not spawn, resume, or contact reviewer agents;
   the parent orchestrates all coder/reviewer communication.
4. Run Luna reviewer after implementation. Luna must independently inspect the
   complete diff and run `npm run lint:working-tree`, checking deterministic
   behavior, modular architecture, clean-code limits, tests, and unrelated
   worktree preservation. The reviewer does not edit implementation files.
5. Route actionable findings back to the implementation agent, then repeat the
   review until no actionable findings remain. Address runtime-startup errors
   before relying on test results.
6. At the final checkpoint, run the repository-required validation in its
   documented order. Do not commit or push unless explicitly requested; Git
   handoffs belong to the Luna Git profile.
