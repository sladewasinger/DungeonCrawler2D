# Final-gate server fixture repairs

- Task: `2026-08-03-final-gate-server-fixtures`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `repopulation.test.ts; reconnect.test.ts; reflectionPosition.test.ts; populationCohesion.test.ts; population/nearSpawn.test.ts; nearest test-support paths; workflow records`
- Preserve: `All production gameplay/tuning, cache fixtures, other tests, and unrelated dirty work.`

## Goal

Repair five prompt stale server geometry/fixture families without weakening density, reconnect, reflection, or population behavior.

## Plan

- [x] Derive finite positions/pack candidates from current metadata or explicit adapters.
- [x] Preserve deterministic density/species and projectile behavior assertions.
- [x] Run exact files, aggregate, game-server typecheck, and lint.

## Decisions

- The cache two-worker timeout is explicitly outside this card.
- Population tests now rank valid chunks across the prepared floor bounds and
  select the most populated whole-floor or near-spawn candidate. Every test
  receives a fresh World/SimState/RNG; only immutable prepared-floor data is
  reused by the existing server fixture seam.
- Deeper-floor repopulation starts from a valid derived floor-2 population
  tile. Near-spawn activation starts from valid current terrain, and bounded
  production refill intervals are driven until the configured target is met
  before proving no overpopulation. All target/type caps remain read from
  `ENEMY_SIMULATION_TUNING`.
- The boundary-pair fixture derives height-valid cells at the configured
  near-spawn radius, authors only those three test tiles as Floor, and retains
  center-based inside/outside classification plus atomic pair acceptance and
  rejection.
- The one reconnect case requiring a large flat arena uses the authored
  floor-1 Combat Sandbox. Finite reconnect identity, safe-room return-stack,
  invite, boundary, and reaping cases remain on the canonical finite fixture.
- Projectile north-approach geometry uses the exported
  `COMBAT_SANDBOX_LAYOUT.playerSpawn`; all inline, offset, near-miss, swept,
  vertical-band, and direct-contact assertions remain unchanged.

## Handoff

- Changed: Five scoped test files plus population-only test support:
  `populationTestSupport.ts`, `populationCohesionSupport.ts`,
  `nearBoundaryPackFixture.ts`, and the new domain helpers
  `populationTerrainFixture.ts` / `nearSpawnPopulationFixture.ts`. No
  production gameplay, tuning, cache, or configuration file changed.
- Validation:
  - Each file passes independently with one worker: repopulation `4/4`,
    reconnect `6/6`, reflection `6/6`, cohesion `9/9`, near-spawn `7/7`.
  - Two-worker aggregate passes: `5` files, `32` tests, `3.81s`.
  - `npm run typecheck --workspace @dc2d/game-server` passes.
  - `npm run lint:working-tree` passes, including file complexity/size,
    configuration documentation, and changed-folder checks.
- Remaining: Independent review. The separate cache-lifecycle timeout remains
  unresolved by design; parent owns later eight-file and full-suite gates.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Scope verification: the repairs are confined to the five named server tests
  and population-specific test support; no production gameplay, tuning, cache,
  or configuration path changed for this card.
- Contract verification: each population case creates fresh mutable state from
  prepared immutable floor data and derives valid terrain while retaining exact
  tuning-derived targets, caps, required-pair atomicity, deterministic seeds,
  territory/native roster checks, and Sandbox no-op coverage. The bounded
  refill helper still requires the exact target and proves a subsequent refill
  cannot overpopulate. Boundary-only tile overrides are local to the fresh test
  World and retain center-based acceptance/rejection assertions.
- Fixture verification: the one arena-dependent reconnect case uses the
  authored floor-1 Combat Sandbox while finite identity/return-stack cases stay
  canonical; the projectile swept-step case uses the exported Combat Sandbox
  spawn and preserves all six reflection/contact assertions.
- Validation: the two-worker five-file aggregate passes (`5` files, `32` tests,
  `3.81s`) with `--reporter=verbose`; the game-server workspace typecheck and
  `npm run lint:working-tree` pass, including configuration-documentation and
  changed-folder checks.
- Findings: none.
- Resolution: ready for parent finalization; the separate cache-lifecycle
  timeout remains outside this card.

## Memory candidates

- None.
