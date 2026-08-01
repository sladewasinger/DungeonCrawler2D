# Ranged burst cadence and roaming pack anchors

- Task: `2026-08-01-projectile-burst-cadence`
- Status: `complete`
- Parent: `primary thread`
- Coder: `unassigned`
- Scope: `packages/game-server/src/sim/{state/enemyState.ts,enemies/ai/attackAnimation.ts,enemies/configuration/enemySimulationTuning.json,enemies/population/packs.ts,enemies/population/nearSpawn.ts,enemies/tests/enemyAi.test.ts,enemies/tests/combat/enemyAiCommittedAnimation.test.ts,enemies/populationCohesion.test.ts,enemies/population/nearSpawn.test.ts,integration/combat/combat.test.ts}`
- Preserve: `infra/tfplan`; unrelated dirty state outside this hotfix in
  `packages/content/src/data/enemies.json` (enemy epithet edits),
  `packages/content/src/data/strings.json`,
  `packages/game-server/src/sim/announcer/lines.ts`, and
  `.codex/agents/spark-explainer.config.toml`; Pitchbloom attack cadence and
  oil-lob RNG/impact behavior; enemy content definitions and biome rosters;
  melee AI; authored mini-boss, boss, sandbox, training, admin, and
  singleton-repopulation composition; client/wire animation contracts; Git
  state

## Goal

Make the server cap each accepted ranged attack cycle at one or two consecutive
releases before the enemy serves its existing authored cooldown. Spitter and Orc
Shaman releases are projectiles; each Chort directional-flame sweep is one release
in the same cadence rule. Pitchbloom remains the sole exception and continues to
launch exactly one oil lob per current windup/recovery/cooldown cycle, without an
extra RNG draw or any changed oil targeting, impact, status, area, or boundary
behavior.

Also make every successfully created ordinary roaming enemy pack contain at least
one Chort and one Pitchbloom. Here, a pack/group means the single
`spawnEnemyPack` unit created for an eligible dungeon chunk. It does not mean a
whole floor, a generated population room, an occupied-area refill, or an authored
arena encounter.

Acceptance criteria:

- With a valid target, each accepted Spitter or Orc Shaman burst authoritatively
  releases either one or two projectiles, selected with the seeded server RNG,
  and never a third release in that burst.
- Both ordinary projectile types retain their authored owner/tags, damage, and
  status payload: Spitter keeps its 50% poison application and Orc Shaman keeps
  its distinct damage and 35% poison application on every released projectile.
- Chort performs either one or two complete directional-flame sweeps per accepted
  burst. Every sweep retains the existing path, segment timing, per-sweep
  single-hit set, fire damage/status, terrain/sanctuary/arena boundaries, and
  spread-free target refresh; no projectile entity is created for Chort.
- Pitchbloom still follows `windup -> one oil-lob release -> spit -> recover ->
  idle`, creates no burst continuation state, and consumes no burst-selection RNG.
- One authored cooldown is committed when the initial shoot decision is accepted.
  It is not recommitted or decremented during windup, any first/second release, or
  recovery; after the final release and recovery, normal active AI ticks decrement
  the unchanged `attack.cooldown` before another windup may begin.
- The existing replicated states remain `windup`, `spit`, `recover`, and `idle`.
  A two-release burst lengthens the committed `spit` phase rather than adding a
  wire state or requiring client changes.
- Existing target safety wins over burst completion: a target invalidated before
  a pending release cancels that release and enters recovery, so no stale/dead/
  disconnected/sanctuary target is attacked merely to satisfy the selected count.
- Every successfully spawned ordinary roaming pack on any dungeon floor contains
  at least one `chort` and one `pitchbloom`, remains within the configured pack
  maximum and global/near-spawn population caps, and never leaves a partial
  required pair when capacity or valid placement cannot fit both.
- Floor-one near-spawn packs have an effective/configured minimum of two. Their
  aggregate target count, per-type cap, exit exclusion, and placement safety remain
  intact. Supplemental pack members continue to use the local biome roster and
  existing optional outlier selection.
- Generated population-room geometry and loot are unchanged. Single-enemy
  occupied-area repopulation remains a refill mechanism rather than a pack and is
  not forced to add a pair. Authored mini-boss compositions (orc and greater-demon),
  the floor-five Warden, room isolation, sandboxes/training fixtures, and
  admin/manual spawns remain unchanged.

## Plan

- [ ] In `packages/game-server/src/sim/state/enemyState.ts`, add one optional,
  server-only counter to the ranged attack animation data for releases remaining
  in the current burst. Keep it out of `EnemyBrain`: the brain already owns target
  selection and `attackCooldown`, while committed release sequencing belongs to
  the server animation state and is cleared automatically whenever animation is
  replaced with idle/recovery state.
- [ ] In `packages/game-server/src/sim/enemies/ai/attackAnimation.ts`, classify
  burst cadence by delivery behavior: every ranged attack except `elemental ===
  "oil-lob"` is eligible. At the first valid release, use `sim.rng.int(1, 2)` once,
  release attack one, and store only the remaining count. Do not draw for
  Pitchbloom. Keep `packages/content/src/data/enemies.json`, the enemy schema, and
  the engine `EnemyBrain`/`enemyThink`/`commitEnemyAttack` implementation unchanged.
- [ ] Continue an ordinary Spitter/Orc Shaman burst when the current `spit` pose
  expires: refresh the same target through `rangeReleaseTarget` (including the
  stable firing-spread offsets), launch at most one pending projectile, decrement
  the counter, and reuse the existing `rangedAttack` ticks as the inter-projectile
  cadence. Enter the existing recovery after the last or canceled release.
- [ ] When `advanceElementalEnemyAttack` reports a completed Chort sweep, use the
  same pending-release helper to refresh the live target and begin at most one
  second `directional-flame` state. Preserve the `spit` presentation throughout;
  after the last/canceled sweep, enter the existing ranged recovery. Leave
  `elementalEnemyAttack.ts`, `directionalFlame.ts`, and `oilLob.ts` unchanged so
  their delivery and safety contracts remain the source of truth.
- [ ] Preserve the attack-loop cooldown transition in
  `packages/game-server/src/sim/enemies/ai.ts`: commit the authored cooldown once
  when the first windup is accepted. Rely on the existing committed-animation
  exclusion in `activeCombatData.ts` to freeze that value through the complete
  burst and recovery, then let `enemyThink` resume its normal `TICK_DT` countdown.
- [ ] In `packages/game-server/src/sim/enemies/configuration/enemySimulationTuning.json`,
  raise `nearSpawnPackMinimum` from one to two so the configuration truth permits
  the required Chort/Pitchbloom pair; leave dungeon maximums, population targets,
  spread radius, and archetype caps unchanged.
- [ ] In `packages/game-server/src/sim/enemies/population/nearSpawn.ts`, add a
  cohesive batch-capacity check (with the existing single-enemy check delegating
  to it) that evaluates total and per-type additions before mutation. This lets a
  required pair be accepted or rejected atomically near floor-one spawn.
- [ ] In `packages/game-server/src/sim/enemies/population/packs.ts`, define the
  required pack members as the domain concepts `chort` and `pitchbloom`, reserve
  the first two valid placements for them, and draft the pack before calling
  `spawnEnemy`. Abort without spawning either required member if the global cap,
  near-spawn batch caps, anchor envelope, or a second valid location cannot hold
  the pair. Spawn any successfully drafted optional members up to the selected
  two-to-four size using the existing native pack definition/outlier rules.
- [ ] Do not change `populationRoster.ts`: biome rosters select supplemental pack
  members and singleton repopulation, not mandatory members. Do not change engine
  `populationRoomsForChunk`: those “rooms” are generated geometry used here for
  loot, while ordinary enemies currently use safe random chunk/nearby spots. Do
  not change `repopulation.ts` or mini-boss encounter composition because they
  create single refills and authored arena groups, respectively, not roaming packs.
- [ ] In `packages/game-server/src/sim/enemies/tests/enemyAi.test.ts`, add seeded/
  controlled-RNG cases for one- and two-release Spitter and Orc Shaman bursts,
  payload preservation, one- and two-sweep Chort bursts with zero projectile
  entities, target invalidation between releases, and exactly one Pitchbloom oil
  lob with no burst RNG selection.
- [ ] In `packages/game-server/src/sim/enemies/tests/combat/enemyAiCommittedAnimation.test.ts`,
  cover a forced two-release projectile burst and Chort sweep burst across all
  committed phases: reservation and full authored cooldown remain stable, no third
  release occurs, cooldown starts decreasing only after recovery, and a later
  burst cannot start early.
- [ ] Update the Spitter snapshot cadence assertion in
  `packages/game-server/src/sim/integration/combat/combat.test.ts` to cover both
  valid burst lengths without assuming recovery exactly two ticks after the first
  projectile. Continue asserting authoritative windup, facing, projectile
  replication, continuous `spit`, and eventual recovery.
- [ ] In `packages/game-server/src/sim/enemies/populationCohesion.test.ts`, test
  successful remote and floor-one-near-spawn packs across deterministic seeds:
  every pack contains both required species, has two-to-four safely clustered
  members, and optional members still come from the native/outlier path. Add a
  capacity/placement regression proving no lone required member is committed when
  a complete pair cannot be drafted.
- [ ] In `packages/game-server/src/sim/enemies/population/nearSpawn.test.ts`, assert
  initial chunk activation and refill interaction stay within the shared target and
  per-type caps with the two-member pack minimum, preserve the exit exclusion, and
  expose both required species after successful near-spawn pack creation. Keep the
  existing repopulation and authored encounter tests as regression coverage for the
  explicitly excluded singleton/group semantics.
- [ ] During implementation, run `npm run lint:working-tree` after edits. At the
  final validation checkpoint run the focused ranged/elemental/population tests,
  then `npm test`; reserve `npm run lint` for a later pre-commit/release gate.

## Decisions

- A Chort “release” is one complete segmented directional-flame sweep, not a
  projectile. It shares the one-or-two release cap and cooldown gate while keeping
  its existing non-projectile implementation.
- Pitchbloom is identified by its `oil-lob` delivery, which is unique in current
  content. Excluding that delivery is safer than scattering a species-name special
  case and guarantees its current RNG sequence remains unchanged.
- Burst size is an equal seeded server-RNG choice in the inclusive range one to
  two, made only when the first release has a valid target. No second windup is
  inserted; existing attack-pose ticks separate ordinary projectiles, and completion
  of one Chort sweep gates a possible second sweep.
- “Spawn group” is the ordinary roaming pack produced by `spawnEnemyPack`, not all
  enemies on a floor or in a generated room. The guarantee is atomic for each
  successfully created pack; when two safe/cap-compliant placements are unavailable,
  no partial required pair is spawned.
- Authored arena encounters are intentionally excluded: forcing Pitchbloom into
  the orc or greater-demon composition would alter boss-room identity and is not
  needed to satisfy ordinary spawn-group composition. Singleton repopulation is
  likewise excluded because the runtime does not retain pack identity after spawn.

## Handoff

- Changed: Server cadence/state, ranged cadence helper, centered roaming-pack
  drafting/capacity checks, cooldown-gated ranged spacing, pending-target
  recovery, mini-boss elemental cleanup, and focused regressions are changed in
  the worktree. The unrelated dirty paths listed in Preserve, including
  `infra/tfplan`, remain preserved and are excluded from the hotfix handoff.
- Validation: The focused Vitest suite passed 6 files and 42 tests. `npm run
  lint:working-tree` passed, including configuration-doc and changed-folder
  checks. `git diff --check` passed. No full test suite was run.
- Remaining: Scoped gameplay review is approved. Parent should preserve the
  unrelated dirty paths listed in Preserve and exclude them from the scoped
  hotfix handoff.

## Review

### Round 1 — `changes-requested`

- Reviewer: `luna-reviewer / primary thread`
- Findings:
  - `[P1] packages/game-server/src/sim/enemies/ai/attackAnimation.ts:164` —
    `npm run lint:working-tree` fails the repository's max-lines rule: the module
    has 151 code lines against the 150-line limit. Extract a cohesive cadence or
    target-safety helper/module so the changed file passes the hard gate.
  - `[P1] packages/game-server/src/sim/enemies/population/packs.ts:106-107,119,149-150`
    — near-spawn drafting classifies candidate tile origins, while
    `nearSpawnPopulationCounts` counts spawned entity centers. A pack on the
    96-tile boundary can therefore pass the preflight and exceed the aggregate or
    per-type cap (or reject a valid pair). Use one center-coordinate helper for all
    near-spawn placement and batch-cap checks.
  - `[P1] packages/game-server/src/sim/enemies/miniBossArena/aggro.ts:132-139` —
    clearing an authored arena enemy's outside-target animation resets it to idle
    without deleting `elementalAttack`. An active Chort sweep can then remain stale,
    advance during a new windup, and block or mis-sequence the next release. Delete
    the elemental state with the animation reset and add a regression for an active
    sweep whose target leaves while another valid occupant remains.
  - `[P2] packages/game-server/src/sim/enemies/tests/enemyAi.test.ts:58-78`,
    `packages/game-server/src/sim/enemies/tests/combat/enemyAiCommittedAnimation.test.ts:43-103`,
    and `packages/game-server/src/sim/enemies/populationCohesion.test.ts:61-120` —
    coverage does not exercise the planned one- and two-release Spitter and Orc
    Shaman cases, projectile payloads, invalidation before a pending release, the
    no-third-release/later-cooldown boundary, or deterministic near/remote pair
    placement failure, cap, exclusion, and optional/outlier behavior. Add focused
    controlled-RNG regressions for those acceptance criteria.
- Resolutions:
  - `[P1] Resolved by extracting ranged cadence and target-safety helpers into
    the existing attack-animation slice; lint now passes.
  - `[P1] Resolved by using the shared tile-center conversion for drafted
    near-spawn candidates, batch caps, and placement checks.
  - `[P1] Resolved by deleting stale `elementalAttack` during authored arena
    target-clear resets and adding the active Chort regression.
  - `[P2] Resolved with controlled-RNG projectile, payload, invalidation,
    cooldown, Chort, and deterministic population regressions.

### Round 2 — `changes-requested`

- Reviewer: `luna-reviewer / primary thread`
- Findings:
  - `[P2] packages/game-server/src/sim/enemies/populationCohesion.test.ts:84-128`
    and `packages/game-server/src/sim/enemies/population/nearSpawn.test.ts:60-93` —
    the new tests cover several remote seeds, one near-spawn success, global-full,
    and shared-total-cap cases, but still do not prove the required pair is atomic
    when the second safe placement fails, or that deterministic near-boundary
    packs preserve the exit exclusion, per-type cap, native supplemental roster,
    and optional outlier behavior. Add focused deterministic fixtures for those
    acceptance cases and assert the resulting positions/definitions.
  - `[P2] packages/game-server/src/sim/enemies/ai/attackAnimation/rangedCadence.ts:1`,
    `packages/game-server/src/sim/enemies/tests/combat/enemyAiCommittedAnimationSupport.ts:1`,
    and `packages/game-server/src/sim/enemies/tests/miniBossArena/aggro.test.ts:1` —
    newly added files do not open with the required one-sentence ownership comment
    from `docs/ENGINEERING_STANDARDS.md`. Add concise domain ownership comments at
    the top of each new file before approval.
- Resolutions:
  - `[P2] Resolved with deterministic population fixtures covering atomic
    second-placement failure, near-boundary exit exclusion and per-type caps,
    native supplemental members, optional global outlier selection, and
    resulting definitions and centered positions.
  - `[P2] Resolved by adding the required one-sentence ownership comments to
    each newly added ranged-cadence and regression-support file.

### Round 3 — `changes-requested`

- Reviewer: `luna-reviewer / primary thread`
- Findings:
  - `[P2] packages/game-server/src/sim/enemies/populationCohesion.test.ts:137-151`
    and `packages/game-server/src/sim/enemies/population/nearSpawn.test.ts:90-101`
    — the current additions cover generic near-spawn success and shared-cap
    rejection, but do not contain the claimed deterministic near-boundary fixture.
    They therefore do not prove that center-based classification preserves the
    exit exclusion and per-type cap when a drafted pack straddles the population
    radius. Add a controlled near-boundary pack case that asserts both required
    members are either atomically accepted or rejected, and checks actual spawned
    centers, aggregate count, per-type count, and exclusion status.
- Resolutions:
  - `[P2] Resolved by extracting grouped deterministic fixture support into
    focused population-test modules. Near-boundary tests now assert shared
    center classification, exact Chort/Pitchbloom definitions and centers,
    exit exclusion, aggregate/per-type caps, and atomic rejection when the
    drafted required pair straddles outside the near-spawn radius.

### Round 4 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Validation: Focused Vitest suite passed 6 files and 42 tests; independent
  `npm run lint:working-tree` and `git diff --check` passed. No full test suite
  was run.

### Focused-test follow-up — resolved

- Resolutions:
  - Required-member population assertions now allow the natural one-each
    Chort/Pitchbloom pair, while controlled RNG explicitly proves native
    supplemental selection and a selected optional outlier.
  - Boundary tests compare spawned center coordinates rather than full body
    runtime objects.
  - Committed cooldown tests advance through recovery into a thinking tick;
    ranged spacing no longer synthesizes a shoot decision while cooldown is
    positive.
  - Invalid pending ranged targets now enter the existing ranged recovery and
    clear stale elemental state without changing Pitchbloom cadence.

### Round 5 — `changes-requested`

- Reviewer: `luna-reviewer / primary thread`
- Findings:
  - `[P1] packages/content/src/data/enemies.json:123` — the Goblin epithet
    changes from `out-negotiated by a goblin` to `gobbled up by a goblin`.
    Enemy content definitions are explicitly preserved by this task and this
    edit is unrelated to projectile cadence or roaming-pack composition.
    Restore the original epithet or move the content change to its own task.
  - `[P2] packages/content/src/data/strings.json:2-3` — the premise and
    tagline are unrelated product-copy changes outside the task scope. Remove
    them from this task's diff or assign them to a separate change before
    approval.
- Validation: Independently ran `npm run lint:working-tree` successfully and
  `git diff --check` successfully. No tests were run, per the audit request;
  `infra/tfplan` remains preserved.

### Round 6 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None in the scoped gameplay changes. The Round 5 content findings
  are reclassified as concurrent dirty state outside this hotfix and are
  preserved, along with the unrelated announcer edit and `.codex` config.
- Audit: Spitter/Orc Shaman one-or-two release bounds, Chort continuation and
  cleanup, Pitchbloom exemption, target invalidation recovery, committed
  cooldown gating, atomic required pack drafting, centered near-spawn caps,
  placement safety, optional roster behavior, exclusions, and modularity rules
  remain satisfied.
- Validation: Independently ran `npm run lint:working-tree` successfully and
  `git diff --check` successfully. No tests were run, per the audit request.

## Memory candidates

- None.
