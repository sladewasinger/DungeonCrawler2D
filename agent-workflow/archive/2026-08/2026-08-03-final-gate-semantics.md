# Final-gate semantic test recovery

- Task: `2026-08-03-final-gate-semantics`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `selfInterpolation.test.ts; inputAdapters.test.ts; enemyLifecycle.test.ts; walls.test.ts; nearest existing test-support paths; workflow records`
- Preserve: `All production paths unless exact reproduction proves a product defect and the card is updated first; other tests and worker configuration.`

## Goal

Resolve or separately route the four prompt semantic candidates without weakening interpolation, action gating, enemy snapshots, or raised-cell surface contracts.

## Plan

- [x] Reproduce each exact assertion and identify current authoritative behavior.
- [x] Repair stale test expectations/doubles only; create a separate product card for any contradiction.
- [x] Run exact files and aggregate, relevant typechecks, and lint.

## Decisions

- Seven isolated-pass final-gate files remain outside this card for worker-pool stabilization.
- No production contradiction reproduced; all four candidates were stale test
  setup or absolute expectations, so no product-defect card was created.
- Floor-zero Sandbox terrain is the authored Combat Sandbox bounded around
  positive world coordinates. Interpolation now starts at its current interior
  player location and derives `z` through `world.groundAt`, while preserving the
  unsimulated-remainder and render-only mutation assertions.
- `Connection.canAct` intentionally requires `status === "connected"`,
  `worldReady`, a received snapshot, positive HP, and a non-downed player. The
  adapter test now establishes every readiness precondition before asserting
  that the live getter changes to true.
- Death on floor zero intentionally transfers a player to floor one, removing
  its snapshot from the originating `GameSim`. The enemy lifecycle contract
  requires observing in-sim respawn, so its lightweight fixture is now the
  authored floor-1 `LEVEL.CombatSandbox`; the open arena and every chase,
  damage, loot, respawn-distance, and starter-kit assertion remain unchanged.
- Finite floor elevations are normalized relative values and may top out at
  zero. A raised surface contract is therefore `raised > adjacent floor`, not
  absolute `raised > 0`; tile, terrain, collision, and topology assertions are
  unchanged.

## Handoff

- Changed: Test setup/expectations only in `selfInterpolation.test.ts`,
  `inputAdapters.test.ts`, `enemyLifecycle.test.ts`, and `walls.test.ts`. No
  production or shared test-support file changed.
- Validation:
  - Each file passes independently with
    `--maxWorkers=1 --reporter=verbose` (`3 + 2 + 2 + 6 = 13` tests).
  - Combined single-worker aggregate passes: `4` files, `13` tests, `3.29s`.
  - Client, engine, and game-server workspace typechecks pass.
  - `npm run lint:working-tree` passes, including configuration documentation
    and changed-folder size checks.
- Remaining: Independent review. Parent owns the bounded 15-file aggregate;
  this scoped card intentionally did not run the full suite.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Scope verification: only the four named test files changed for this card; no
  production, shared test-support, or worker-pool path was modified.
- Contract verification: interpolation retains remainder projection and
  render-only state checks from a current walkable authored location; the input
  adapter now supplies every readiness precondition required by the live
  `Connection.canAct` getter; enemy lifecycle uses a floor-1 Combat Sandbox so
  its existing in-sim respawn assertions exercise the intended lifecycle; and
  raised finite terrain is asserted relative to its adjacent floor while tile,
  terrain, collision, and topology coverage remains intact.
- Validation: the four-file single-worker aggregate passes (`4` files, `13`
  tests, `3.26s`) with `--reporter=verbose`; client, engine, and game-server
  workspace typechecks pass; `npm run lint:working-tree` passes, including
  configuration-documentation and changed-folder checks.
- Findings: none.
- Resolution: ready for parent finalization and the parent-owned bounded 15-file
  aggregate.

## Memory candidates

- None.
