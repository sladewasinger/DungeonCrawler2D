# Ranged projectile feel follow-up

- Task: `2026-08-01-ranged-projectile-feel`
- Status: `complete`
- Parent: `primary thread`
- Coder: `luna-coder / primary thread`
- Scope: `packages/game-server/src/sim/enemies/{ai/attackAnimation.ts,ai/attackAnimation/rangedCadence.ts,ai/combat.ts,configuration/enemySimulationTuning.json,tests/combat/enemyAiCommittedAnimation.test.ts,tests/combat/enemyAiRangedCadence.test.ts,tests/combat/enemyAiCommittedAnimationSupport.ts,tests/search/enemyTargetAcquisition.test.ts}; packages/game-server/src/server/admin/adminEnemyBehavior.test.ts; packages/engine/src/combat/geometry/{combatHurtboxTuning.json,combatHurtboxTuning.ts,hurtboxes.ts,hurtboxes.test.ts}; packages/game-server/src/sim/{admin/adminMapDebug.test.ts,projectiles/{index.ts,reflection.ts,reflection.test.ts,reflectionPosition.test.ts}}; packages/client/src/input/{actions/attack.ts,actions/pointerActions.ts,controls/state.ts}; packages/client/src/scenes/dungeon/input/{inputQueries.ts,projectileReflectionAim.ts,projectileReflectionAim.test.ts}; focused tests directly beside those paths only`
- Preserve: `all existing user dirty state; packages/content/src/data/enemies.json and every authored enemy cooldown/payload; Chort directional-flame delivery; Pitchbloom oil-lob targeting/RNG/impact; block behavior; non-player hurtboxes; projectile wire payloads and client projectile rendering; unrelated product code/tests; Git state`

## Goal

Make the narrow post-hotfix feel corrections without reopening ranged AI, general
melee balance, or projectile presentation:

1. Ordinary two-projectile bursts release projectile two approximately 500 ms
   after projectile one at the fixed 20 Hz simulation rate. Keep the equal seeded
   one-or-two burst choice, one authored normal cooldown per accepted attack,
   target-safety cancellation, payload capture, Chort's current one-or-two complete
   directional-flame sweep behavior, and Pitchbloom's one-lob exemption.
2. Give each ordinary Spitter/Orc Shaman projectile a small, configurable,
   server-seeded landing variation around its already resolved live target. Do not
   alter Chort or Pitchbloom targeting, and do not mutate owner, tags, damage, or
   status payloads.
3. Fix the screenshot-specific sword-reflection mismatch at its narrow root: an
   elevated projectile is rendered above its authoritative horizontal body point,
   so aiming at the visible projectile can send a cone direction that misses
   `projectile.body.x/y`. Reconcile pointer aim for an ordinary returnable projectile
   to that projectile's authoritative horizontal position while retaining its
   visible direction for the self swing presentation. Do not widen the sword cone,
   enlarge projectile contact radius, remove the z gate, or change blocking.
4. Preserve the authored player combat-hurtbox configuration and prove its
   resulting projectile-contact boundary without changing any enemy/default/
   authored enemy hurtbox.

Acceptance criteria:

- `rangedProjectile.interReleaseTicks` is `10`; at `TICK_RATE = 20`, consecutive
  ordinary projectiles in a forced two-release burst are launched exactly 10
  simulation ticks (500 ms) apart. A one-release burst does not wait an extra
  inter-release interval before normal recovery.
- The existing `rangedAttack` and `rangedRecovery` pose values remain authored
  independently. The new interval does not replace or recommit Spitter's 2 s or
  Orc Shaman's 2.2 s normal cooldown, and cooldown remains frozen through windup,
  the complete burst, and recovery before normal AI countdown resumes.
- Chort still performs one or two complete directional-flame sweeps using its
  existing segment timing, hit-once set, target refresh, and boundaries. Its second
  sweep remains completion-gated by sweep one rather than being converted into an
  ordinary projectile timer. Pitchbloom still performs one oil lob, has no pending
  release, consumes no burst-selection/landing-variation RNG, and retains its
  existing oil targeting error.
- `rangedProjectile.landingVariationRadiusTiles` is the single ordinary-projectile
  landing knob, initially `0.2`. Each launch samples a reproducible offset from the
  simulation's seeded RNG inside a radius-0.2 disk and adds it after the existing
  live-target refresh and stable formation spread. Same seed/state gives the same
  launch velocity; different controlled draws can produce different bounded landing
  points.
- Target validity is checked before variation or launch. Disconnect, death/downed,
  spawn protection, sanctuary, or missing target before projectile two still cancels
  it and enters recovery. Every launched projectile retains the exact owner ID,
  `spit`/enemy tags, authored damage, and copied status applications.
- On flat terrain in every supported view orientation, clicking/aiming at the
  rendered center of an in-range ordinary spit resolves the network attack direction
  from player body to projectile `body.x/y`, while the local sword swing continues
  toward the clicked rendered position. A stale or rejected client hint cannot force
  reflection; the server still validates the existing returnable-spit predicate,
  active attack window, weapon profile range, horizontal cone, projectile radius,
  and vertical band.
- Pointer aim not on an eligible ordinary spit is byte-for-byte behaviorally
  unchanged. Oil lobs, item projectiles, already returned spits where identifiable,
  enemies, terrain, touch/kid assisted aim, and non-pointer attacks do not take the
  reflection-specific correction path.
- Blocking remains distinct from reflection. Direct-hit eligibility uses the
  authoritative projectile body/contact volume; guard-facing direction uses the
  projectile's current horizontal arrival line, with owner position only as a
  zero/absent-velocity fallback. Reflection still additionally requires the
  current projectile volume to be in finite sword range/cone and vertical band.
  No sword-volume predicate, guard arc, feedback, or blocked oil-lob behavior is
  shared into blocking.
- The authored player hurtbox remains the current values in
  `combatHurtboxTuning.json`. Runtime/debug bounds and direct-contact tangency
  are derived from `PLAYER_HURTBOX` and `combatHurtboxBounds`; no test assumes a
  prior player width, depth, height, or bottom offset.
- Lowering player height does not change `weaponHitboxVerticalRange`: with
  `strikeHeightOffset = 0.5` and `verticalHalfExtent = 0.5`, a player at `z = 0`
  still swings through `0..1`, and a radius-0.25 projectile remains reflectable at
  center `z = 1.25` but not `1.251`. The direct-contact-only band above reflection
  narrows by 0.25 tile but is not silently eliminated or treated as the screenshot's
  horizontal-aim fix.
- Existing `ENEMY_HURTBOX`, `DEFAULT_HURTBOX`, definition-authored enemy hurtboxes,
  projectile payload fields, and projectile visual z projection remain unchanged.

## Investigation findings

- `packages/client/src/render/entities/visuals/projectileEntityVisual.ts` renders an
  authoritative projectile body through `groundToScreen(view.x, view.y, view.z)`, so
  its view-space y is lifted by `body.z`. Ordinary projectile snapshots carry that
  authoritative z unchanged through `projectileViews.ts`.
- Desktop swing presentation in `selfAim.ts` points at the raw rendered cursor, while
  `pointerActions.ts` converts the same cursor through terrain-only
  `cursorWorldTile`. The terrain picker can recover a raised floor cap but cannot
  identify an airborne projectile. A cursor on a spit therefore resolves as a ground
  point at the spit's lifted screen row, not as the spit's horizontal `body.x/y`.
- The server captures that direction in `doAttack` and reflection calls
  `weaponHitboxContainsPoint` with the projectile's unprojected body. The sword profile
  is a finite 90-degree cone (`range: 2`, `arcCos: 0.7071`) plus the shared radius-0.25
  projectile sphere and `0..1` vertical weapon volume at player z 0. This explains
  why visibly aligned aim can miss while noticeably lower aim, toward the body's
  ground projection, reflects.
- Vertical mismatch is a separate possible rejection, not the screenshot's primary
  cause: changing only aim direction cannot change projectile z. Tests must record
  projectile `body.z` on the reflection tick and keep the existing exact 1.25/1.251
  reflection boundary visible.
- Ordering is already favorable to reflection. `processActions` checks projectiles at
  attack acceptance; later in the same simulation tick, `stepProjectiles` moves each
  projectile, calls `returnProjectileDuringActiveMeleeAttack`, and only then calls
  `findDirectHit`/damage resolution. Existing coverage proves a projectile entering
  the active sword volume during movement is returned. No ordering change or generic
  swept-hitbox expansion is planned unless the focused reproduction disproves this.
- Blocking and reflection share the authoritative post-step projectile contact
  point but keep distinct predicates. The old blocking mismatch was that
  `projectileBlockedByTarget` preferred the owner's current position for facing;
  a moving owner or landing variation can diverge from the projectile's arrival
  line. Blocking now derives its source point from `projectile.body - projectile.vel`
  when horizontal travel exists, then falls back to the owner/source position for
  stationary or velocity-less fixtures. Reflection still checks only its own timed
  sword-volume, range, z, attack-window, and returnability rules.
- The admin-portal spawn path selects a `GameSim` by the command's level/floor and
  calls the same admin enemy spawner as direct simulation fixtures. It does not
  assign a target or create a player in that floor. A portal-spawned Pitchbloom
  releases normally when a connected, non-graced player is present on that same
  simulation; with no such player, it remains inactive because there is no target.
  This is an existing admin context/AI precondition, not a cadence, oil-lob, or
  blocking regression.
- Target acquisition is recomputed each active tick from the enemy definition's
  aggro radius, terrain LOS, and targetability. Pitchbloom and Spitter use their
  authored radius of 10, Orc Shaman uses 12, LOS permits a maximum height
  difference of 1, and the active simulation envelope is 48 tiles. When a live
  target leaves that visible aggro envelope, revalidation clears `brain.targetId`
  and pending target-bound windups, but preserves the 20-second memory and its
  configured 8-tile search radius. Returning to visible aggro range reacquires the
  same player. “Off-screen” has no server-side viewport gate; a couple of screen
  tiles only matter if movement also crosses one of these world-space limits.
- Focused behavior coverage in
  `packages/game-server/src/server/admin/adminEnemyBehavior.test.ts` reproduces
  the exact admin world-command path, while
  `packages/game-server/src/sim/enemies/tests/search/enemyTargetAcquisition.test.ts`
  covers active-target clearing, bounded memory retention, and reacquisition.
  Existing enemy AI coverage exercises wall rejection, but the new lifecycle
  diagnostic does not yet put terrain obstruction into its loss/reacquisition
  path. No production fix is supported by the reproduction.

## Configuration knobs

- Add to `packages/game-server/src/sim/enemies/configuration/enemySimulationTuning.json`:
  `rangedProjectile.interReleaseTicks: 10` and
  `rangedProjectile.landingVariationRadiusTiles: 0.2`. Keep
  `animationTicks.rangedAttack`, `animationTicks.rangedRecovery`, and every content
  cooldown unchanged. The existing inferred TypeScript boundary in
  `enemySimulationTuning.ts` consumes the new object without a parallel schema.
- Preserve the current authored `player` values in
  `packages/engine/src/combat/geometry/combatHurtboxTuning.json`.
  `combatHurtboxTuning.ts` is the exact typed config consumer and `hurtboxes.ts`
  materializes it as `PLAYER_HURTBOX`; neither schema shape nor fallback selection
  needs a code change.
- Add no reflection-size tuning. Keep `PROJECTILE_CONTACT_RADIUS = 0.25`, weapon
  profile range/arc, and `weaponHitboxTuning.json` (`0.5` strike offset, `0.5` vertical
  half extent) unchanged.

## Plan

- [ ] In `enemySimulationTuning.json`, add the two `rangedProjectile` knobs above.
  In `attackAnimation/rangedCadence.ts`, distinguish a pending ordinary projectile
  from Chort's active elemental continuation when choosing the next `spit` duration.
  Schedule an ordinary second projectile with `interReleaseTicks`; retain the existing
  terminal `rangedAttack` pose and Chort sweep-completion transition.
- [ ] Keep `attackAnimation.ts`'s committed-state machine and `ai.ts` cooldown commit
  site intact. If a small helper signature is needed, pass the next pose duration
  explicitly rather than adding a wire animation state or a second cooldown. Verify
  invalidation at any pending release still calls the existing ranged recovery path.
- [ ] In `ai/combat.ts`, sample two `sim.rng.next()` values for ordinary `launchSpit`
  only and convert them to a uniform disk offset (`angle = 2πu`, `radius =
  configuredRadius * sqrt(v)`). Add that offset to the already live-refreshed and
  formation-spread-adjusted target used solely by `launchVelocity`. Do not mutate the
  animation target, player body, owner/tags, or `directProjectileImpact` object.
- [ ] Keep `beginElementalEnemyAttack`, `directionalFlame.ts`, and `oilLob.ts`
  unchanged. Their absence from the implementation diff is part of proving Chort and
  Pitchbloom behavior stayed bounded.
- [ ] Extend `enemyAiCommittedAnimation.test.ts` and its existing support helper with
  tick-stamped projectile releases. Force one- and two-release Spitter and Orc Shaman
  choices; assert exactly 10 ticks between two ordinary launches, no third launch,
  unchanged authored cooldown throughout committed phases, immediate normal recovery
  for one release, and countdown only after recovery.
- [ ] In the same focused enemy tests, control `rng.next()` to prove deterministic
  center/edge disk samples and the 0.2-tile bound, while reusing
  `expectRangedPayload` for owner/tags/damage/status. Add invalid-target-before-second
  coverage showing no variation draw or launch after cancellation. Retain/strengthen
  the Chort zero-projectile one/two-sweep and Pitchbloom one-lob/no-extra-RNG cases.
- [ ] Add a pure client helper in
  `scenes/dungeon/input/projectileReflectionAim.ts`. Given player body, pointer in
  view-tile coordinates, current view orientation, weapon reach, and current ordinary
  projectile snapshots, select only a projectile whose rendered center
  (`worldToView(body.x/y)` with `z` lift) is under the pointer and whose horizontal
  body is plausibly in weapon reach. Return two directions: authoritative horizontal
  body direction and visible pointer direction. Use deterministic nearest-distance,
  then entity-ID tie breaking.
- [ ] Expose that helper narrowly through `InputQueries` in `input/controls/state.ts`
  and `scenes/dungeon/input/inputQueries.ts`. Use current projectile snapshot fields
  already on the wire; add no protocol field. Filter to ordinary no-`defId`
  projectiles and leave final hostility/returnability authority on the server.
- [ ] In `actions/pointerActions.ts`, ask for the reflection aim only for desktop
  pointer melee before falling back to existing terrain `cursorWorldTile` aim. In
  `actions/attack.ts`, allow an optional presentation direction so `conn.attack`
  receives the projectile-body direction while `onSwing` retains the direction to
  the visible clicked projectile. Touch/kid assisted aim and ordinary pointer attacks
  continue through their current single-direction path.
- [ ] Add pure `projectileReflectionAim.test.ts` coverage at orientations 0/90/180/270
  for an elevated projectile: pointer-visible direction differs from horizontal body
  direction, the eligible spit is selected, oil/item/non-projectile/out-of-reach cases
  are ignored, and ties are deterministic. Add a focused pointer-action regression
  beside `pointerActions.ts` (or the existing pointer test if it remains cohesive)
  asserting the separate network/presentation directions and unchanged fallback.
- [ ] Extend `reflectionPosition.test.ts` with a screenshot-shaped fixture that records
  rendered-direction input, authoritative body direction, and projectile `body.z` on
  the reflection tick. Assert visible uncorrected direction misses horizontally while
  body-corrected direction returns the same projectile inside the existing vertical
  band; preserve the exact z=1.25 tangent/z=1.251 rejection.
- [ ] Extend `reflection.test.ts` with one explicit contract comparison: a direct-contact
  spit from a guarded source is accepted by the unchanged source-direction block rule,
  while reflection still requires active melee, finite profile reach/cone, z alignment,
  and returnability. Keep the existing movement-then-reflection-before-hit regression;
  do not edit `directionalBlock.ts`, `projectiles/index.ts` ordering, or
  `weaponHitboxContainsPoint` unless the new deterministic fixture contradicts the
  recorded diagnosis.
- [ ] In `projectiles/index.ts`, keep direct-hit contact geometry unchanged and derive
  block-facing direction from the authoritative projectile arrival line before using
  the owner position as a stationary/velocity-less fallback. Add a behavior test for
  an owner that moves after launch; do not route blocking through reflection's sword
  volume.
- [ ] Preserve the authored player values in `combatHurtboxTuning.json`. Update
  `hurtboxes.test.ts` to compare runtime bounds with `PLAYER_HURTBOX`, retain
  unchanged enemy/default values, and derive direct projectile tangency from the
  configured max z and contact radius.
- [ ] Add/adjust the focused server projectile regression to show the configured player
  top rejects a high direct hit while an ordinary in-band projectile hit, blocks, and
  reflections still resolve. Assert the sword reflection boundary remains 1.25/1.251
  so the hurtbox change is not mistaken for hitbox unification.
- [ ] During implementation run `npm run lint:working-tree` after iterations. At the
  final checkpoint run focused Vitest files for enemy committed animation, engine
  hurtboxes/weapon hitboxes, client projectile reflection aim/pointer actions, and
  server reflection/position; then run `npm test`. Reserve `npm run lint` for the
  pre-commit/release gate.

## Decisions

- The parent will use each selected `.codex/agents/*.config.toml` profile's
  model and reasoning settings verbatim; any override requires Austin's
  explicit request and must be disclosed before launch. An earlier planner
  launch in this phase incorrectly overrode `sol-planner`'s configured
  `medium` reasoning with `high`; no product work came from that override.
- The 500 ms knob applies to consecutive ordinary projectile launches. Chort is not
  converted into a projectile timer: its release is a complete segmented sweep, and a
  selected continuation remains gated by sweep completion. Pitchbloom remains outside
  both burst timing and ordinary landing variation.
- Landing variation is launch-local and server-seeded. It layers after live-target
  safety and existing stable formation spread so group spacing remains deterministic,
  while repeated ordinary releases are not pixel-identical.
- The screenshot diagnosis is horizontal projection, not a request for a larger cone.
  The correction is a narrow desktop pointer reconciliation when the pointer is on a
  rendered ordinary spit. Server reflection geometry remains authoritative and local
  swing presentation remains aimed at what the player clicked.
- Block and reflection are not made equivalent. They share the projectile's
  authoritative contact/arrival context, but guard success remains a source-facing
  decision at contact while reflection remains a timed physical sword-volume
  interception. Blocking does not inherit sword range, cone, z, or attack-window
  predicates.
- Player hurtbox contact remains configuration-owned. Focused tests derive the direct
  contact band from the configured bounds, while the sword reflection volume remains
  independently tested at its existing boundary.

## Unresolved questions

- Confirm `0.2` tiles in playtest after the deterministic implementation; changing
  only `rangedProjectile.landingVariationRadiusTiles` is the intended tuning follow-up.
- Prefer the frame's interpolated projectile positions for pointer selection if they
  can be injected without broad scene wiring; otherwise use latest snapshots with a
  contact-radius pointer tolerance and keep server validation authoritative. This is
  an implementation-seam choice, not permission to expand reflection geometry.
- Returned ownership is not present on projectile snapshots. If an already returned
  no-`defId` projectile can remain under the pointer long enough to be selected, either
  tolerate the harmless stale hint (server rejects it) or add a client-local returned
  ID marker from observed ownership-changing lifecycle only if existing data already
  exposes one; do not add a protocol field in this follow-up.

## Handoff

- Changed: Scoped ranged cadence, landing-variation, pointer reflection-aim,
  player hurtbox, and focused regression coverage. The ranged cadence and
  landing-variation cases now live in sibling `enemyAiRangedCadence.test.ts`;
  the original committed-animation test is below the 150-line limit. Added the
  type-only `PointerDeps` export, explicit projectile snapshot mapping at the
  query boundary, and configuration-driven player hurtbox/debug/contact tests
  that preserve the authored JSON values. Projectile blocking now derives
  guard-facing direction from the authoritative arrival line with a stationary
  owner fallback; reflection remains a distinct sword-volume predicate.
  Added exact admin-portal Pitchbloom and target-acquisition/revalidation behavior
  coverage. The reproduction supports no production change: an admin-spawned
  Pitchbloom launches when its selected floor has a live target, while no-player
  portal contexts correctly remain targetless. The targetless fixture now uses a
  live player outside configured aggro but inside active simulation and observes
  authoritative snapshots through the release window. Terrain obstruction and
  removal are covered while the player remains in aggro and active range.
  Unrelated dirty files and authored enemy/hurtbox configuration were preserved.
- Validation: `npm run lint:working-tree` passed without warnings,
  `git diff --check` passed, and all artifact-focused Vitest files passed (11
  files, 60 tests). No full repository gates were run.
- Remaining: Parent finalization only. The parent may now run the combined
  repository gates (`npm run lint`, `npm run typecheck`, and `npm test`) and,
  only if they pass, complete/archive the artifact. This review leaves Status
  `in-review` and does not authorize full gates or archiving in this turn.

## Review

Round 1 — 2026-08-01 MDT — `luna-reviewer`

- [P1] `packages/game-server/src/sim/enemies/tests/combat/enemyAiCommittedAnimation.test.ts`
  exceeds the repository hard limit: `npm run lint:working-tree` reports 176
  counted lines, above the 150-line maximum. Move the newly added ranged cadence
  and landing-variation cases into a focused sibling test file (keeping shared
  setup in the existing support helper), or otherwise split this test without
  dropping its coverage, so the file is at or below 150 lines. Re-run the
  working-tree lint before handing back.

- Resolution: [P1] Moved the ordinary release, landing-variation, exact-tick,
  cancellation, and payload cases into
  `enemyAiRangedCadence.test.ts`, preserving the shared support helper and
  ownership comment. The original test is now 100 lines; the sibling is 126
  lines.

No additional behavioral findings: the focused acceptance coverage passed for
ordinary release cadence and seeded disk variation, target cancellation and
payload preservation, Chort/Pitchbloom exclusions, rendered-vs-authoritative
reflection aim, server-side reflection/blocking authority, and the lowered player
hurtbox boundaries.

### Round 2 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Resolutions: [P1] The ranged cadence and landing-variation regressions are
  split into `enemyAiRangedCadence.test.ts`; the working-tree hard limit now
  passes.
- Audit: Final scoped diff and acceptance criteria reviewed. Ordinary cadence,
  seeded bounded variation, RNG exclusions, target cancellation, payload
  preservation, Chort/Pitchbloom behavior, rendered-vs-authoritative pointer
  aim, server authority, blocking, hurtbox boundaries, architecture, and hard
  limits are satisfied.

### Round 3 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Resolutions: Verified the type-only `PointerDeps` export, narrow projectile
  snapshot mapping with optional `defId` omission, and updated admin debug
  hurtbox expectation at `1.4166666667`.
- Audit: Final scoped diff and acceptance criteria remain satisfied for cadence,
  seeded variation and RNG exclusions, target safety and payload preservation,
  Chort/Pitchbloom behavior, pointer rendered-vs-authoritative aim, server
  authority, blocking, hurtbox boundaries, architecture, and hard limits.

### Round 4 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Resolutions: Verified that `hurtboxes.test.ts`, `adminMapDebug.test.ts`, and
  `reflectionPosition.test.ts` derive player geometry from `PLAYER_HURTBOX`,
  `combatHurtboxBounds`, and `PROJECTILE_CONTACT_RADIUS`; the authored
  `combatHurtboxTuning.json` remains preserved.
- Audit: Final scoped acceptance and architecture remain satisfied, including
  cadence, seeded variation and exclusions, target safety, payload preservation,
  Chort/Pitchbloom behavior, pointer aim, server authority, blocking, hurtbox
  boundaries, and repository hard limits.

### Round 5 — `approved`

- Reviewer: `luna-reviewer / primary thread`
- Findings: None.
- Resolutions: Verified that `projectileBlockedByTarget` uses
  `projectile.body - projectile.vel` for non-stationary horizontal travel and
  retains the owner/source fallback for stationary or velocity-less projectiles.
  The moved-owner regression passes, reflection's sword-volume predicate is
  untouched, and the authored hurtbox configuration remains preserved.
- Audit: Final scoped acceptance and architecture remain satisfied, including
  distinct blocking/reflection predicates, direct-contact geometry, guard arc,
  payloads, cadence, seeded variation, pointer aim, target safety, and hard
  limits.

### Round 6 — `changes-requested`

- Reviewer: primary thread
- Findings:
  - [P1] `packages/game-server/src/server/admin/adminEnemyBehavior.test.ts:39-44`
    does not prove that a targetless admin-spawned Pitchbloom remains idle.
    With no players, `GameSim.step()` returns an empty snapshot map by design,
    so `sim.step().size === 0` passes even if the enemy creates a projectile.
    Keep the exact `executeAdminWorldCommand` path, retain the spawned enemy,
    advance through the authored release window, and assert authoritative
    state such as `sim.projectiles.size === 0` (and/or the enemy's target and
    animation state) rather than snapshot-map size.
  - [P2] `packages/game-server/src/sim/enemies/tests/search/enemyTargetAcquisition.test.ts:28-63`
    does not exercise terrain LOS in the target-loss/reacquisition diagnostic.
    Both transitions are caused only by moving beyond `enemy.def.aggroRadius`,
    while the artifact claims this behavior distinguishes aggro/terrain LOS
    from viewport culling. Add a deterministic terrain obstruction while the
    player remains inside both the authored aggro radius and
    `ENEMY_ACTIVE_RADIUS`, assert target loss, remove the obstruction and
    restore a grounded visible position, then assert reacquisition. Reuse
    authored/configured values and existing terrain test helpers; do not add a
    production fix.
- Resolutions: No implementation changes were warranted. The authored
  `combatHurtboxTuning.json` remains untouched by this review, and the new
  diagnostics show no configurable-value duplication or scope creep beyond the
  reported assertion gaps.
- Validation: `npm run lint:working-tree`, `git diff --check`, and the focused
  artifact Vitest files pass (11 files, 59 tests). Status is
  `changes-requested`; no full repository gates, subagents, or archive action
  were used.

### Round 7 — `in-review`

- Reviewer: primary thread
- Findings: Round 6 requested authoritative targetless admin behavior rather
  than an empty snapshot-map assertion, plus deterministic terrain-LOS
  obstruction/removal coverage distinct from range loss.
- Resolutions: Updated `adminEnemyBehavior.test.ts` to place a live observer
  outside Pitchbloom's configured aggro radius but inside the active envelope,
  then assert no enemy windup/spit state or projectile across the configured
  windup-plus-release window. Updated `enemyTargetAcquisition.test.ts` to add
  and remove a terrain obstruction while the target remains inside aggro and
  `ENEMY_ACTIVE_RADIUS`, proving revalidation clears and reacquires the target.
  No production changes were needed. No configurable hurtbox or enemy values
  are duplicated by the revised diagnostics, and the authored hurtbox config is
  preserved.
- Validation: `npm run lint:working-tree`, `git diff --check`, and all focused
  artifact suites pass (11 files, 60 tests). Status remains `in-review`; the
  parent has an explicit final-gate handoff, and no full repository gates,
  subagents, or archive action were used.

### Round 8 — `complete`

- Owner: primary thread
- Findings: None after parent final validation.
- Validation: `npm run lint`, `npm run typecheck`, and `npm test` all passed.
  The full suite passed with 633 files and 2,682 tests. The lint folder-size
  output contains only the three pre-existing legacy oversized-folder warnings.
- Handoff: Artifact is complete and ready for archival; no push performed.

## Memory candidates

- Keep focused acceptance tests split by domain so adding regression coverage
  does not exceed the repository's per-file hard limit.
