# v0.8.0 implementation handoff

Date: 2026-07-30

This file is for the next agent taking over the current v0.8.0 worktree. The
tree is intentionally uncommitted so Austin can playtest before the release
commit and push.

## User-visible bugs that must remain in scope

1. The attack cone/green wedge must not be visible while the player is idle.
   It should appear only for the short attack pulse, follow the player's
   position during that pulse, and keep the attack's captured direction and
   weapon shape. Recovery uses a separate horizontal cooldown bar. Blocking
   should show the shield cone only.
2. Attack and block geometry must draw above nearby screen-south terrain. Do
   not hide the geometry to mask a depth-ordering problem.
3. A successful melee/projectile block must flash the existing blue shield
   cone yellow briefly, then return to blue. There must be no standalone yellow
   radial circle around the player.
4. The held shield cone must be authoritative collision for enemy movement for
   the whole blocking interval, including after the shield successfully blocks
   an attack. Enemies must not enter the player's body through the cone.
5. When unarmed, the local player sprite must face the canonical local aim or
   facing direction left/right just like remote players. It must not stay
   facing right because of stale weapon-orbit state. Preserve desktop mouse,
   kid mode, touch mode, attack-facing, and rotated-camera behavior.

## Broader v0.8.0 scope already present in the worktree

- Data-driven sword, dagger, and hammer profiles with shape/range/damage/
  knockback/cooldown differences.
- Combat geometry split into attack, guard, weapon, feedback, status, and
  geometry modules.
- Larger enemy hurtboxes and tighter player hurtboxes.
- Active-admin-only in-game debug flags for hurtboxes, attacks, guards, LOS,
  behavior/search, and navigation, with actual 2D and Three overlays.
- Secure `/admin` portal with token authentication, connected-player controls,
  spectator free camera/tracking/cycling, a bounded height-map canvas, and
  server-authoritative enemy/item/weapon palette spawning.
- The admin command service is shared by the admin page and authenticated
  gameplay `/admin` chat commands.
- Cached circular minimap/HUD work, dino behavior work, release metadata, and
  v0.8.0 docs are already in the tree.

## Changes completed during this handoff

### Combat/rendering

- `packages/client/src/render/entities/combat/attack/guardCone.ts`
  - is guard-only and hides the graphics object when blocking is inactive;
  - restores the former broad shield silhouette while the shorter guard
    collider remains authoritative;
  - uses the combat overlay depth band;
  - renders block feedback by recoloring/expanding the shield cone itself.
- `packages/client/src/render/entities/combat/attack/attackCooldownIndicator.ts`
  - renders cooldown recovery as a compact horizontal bar, distinct from
    attack and guard geometry;
  - hides when ready, downed, or blocking;
  - completion flashes the currently held weapon white once for 120 ms, only
    after a recorded attack recovery reaches ready.
- `packages/client/src/render/entities/player/playerWeaponVisual.ts`
  - passes block feedback into the shield cone;
  - tracks attack cooldown by weapon profile and updates the separate bar.
- `packages/client/src/vfx/combat/melee/meleeWedge.ts` and
  `packages/client/src/scenes/dungeon/combat/meleeSwingSync.ts`
  - keep the attack area visible for its existing 160 ms lifetime;
  - follow player position during the active attack pulse while preserving the
    direction, profile, tile scale, and full-range depth footprint captured at
    attack start;
  - clear every screen-south terrain row touched by the locked weapon reach,
    rather than only the immediately adjacent row.
- `packages/client/src/render/entities/player/playerFacing.ts` and
  `packages/client/src/render/entities/visuals/playerVisual.ts`
  - body-facing now uses canonical view facing/aim rather than a stale weapon
    angle; unarmed regression cases are covered in
    `playerFacing.test.ts`.
- `packages/content/src/data/items.json`
  - increases the knife, sword, and hammer attack ranges by 20 percent to
    1.62, 2.4, and 2.04 tiles respectively; fists and enemy attack ranges are
    unchanged.
- `packages/game-server/src/sim/projectiles/reflection.ts`
  - lets an accepted player attack return a hostile direct spit when the
    projectile intersects that weapon's real attack area;
  - reverses the projectile, transfers credit to the player, preserves the
    shot's launch-captured damage/status payload, and limits returned shots to
    living enemy targets;
  - deliberately excludes oil lobs and item throwables.
- `packages/game-server/src/sim/actions/melee.ts` and
  `packages/engine/src/combat/weapons/weaponTargeting.ts`
  - keep the authoritative player swing active at 0, 50, 100, and 150 ms,
    exactly matching the existing 160 ms wedge lifetime rather than adding a
    200 ms server contact;
  - resolve late contacts from the player's current position, while preserving
    the accepted direction, weapon profile, source tags, and status payload;
  - contact each entity once per swing, including a blocked contact, and let a
    hostile projectile entering later in the window remain returnable;
  - hit every non-party hostile in a cone, while keeping the closest-party-only
    fallback and suppressing that fallback for the rest of a swing that has
    already contacted a hostile.
- `packages/engine/src/combat/geometry/guardCollision.ts`
  - defines a shared short guard volume and swept, body-radius-aware contact
    math.
- `packages/game-server/src/sim/combat/shieldCollision.ts` and
  `packages/game-server/src/sim/enemies/ai/enemyMovement.ts`
  - apply the authoritative swept guard contact after enemy movement and move
    the enemy back before contact.
- Regression coverage exists in
  `packages/engine/src/combat/geometry/guardCollision.test.ts` and
  `packages/game-server/src/sim/enemies/tests/combat/enemyGuardCollision.test.ts`.

### Admin/security cleanup

- The admin surface is genuinely wired to `AdminSpectatorSurface`, map center
  movement, palette selection, click-to-spawn, spectator controls, and debug
  controls. It is not the old placeholder panel.
- Admin map selectors use camel-case `DOMStringMap` property names while
  retaining their dashed `data-admin-*` attributes, so the admin route boots
  without the browser rejecting an invalid dataset property.
- Persisted `adminGranted` data no longer auto-creates an admin session from a
  client-controlled `hello.clientId`. Admin sessions are created only after
  that connection proves `ADMIN_TOKEN` with `adminAuth`.
- The `/admin` page can restore a proven session after refresh with an opaque,
  peer-bound 256-bit continuation key kept only in browser `sessionStorage`.
  It is not `ADMIN_TOKEN`, is never put in the URL or `localStorage`, expires
  after eight inactive hours, and is invalidated by a server restart.
- Authenticated admin state now streams to the portal roughly four times per
  second, so connected-player presence and positions update without a polling
  control. Verify gameplay and `/admin` use the same server process: dev pages
  target `:8787`, while the local production preview targets `:4002`.
- The admin map palette now exposes a scrollable, game-atlas-backed catalog of
  every content-defined enemy, item, and weapon in its matching category.
  Stats derive from the definition (weapon cards include knockback), while an
  unknown atlas crop gets a safe fallback glyph. Selection remains synchronized
  with the existing map level, floor, inspect, kind, and definition controls.
  Server placement canonicalizes every accepted point to the center of its tile,
  the map renderer uses the same point convention, and authenticated right-click
  removal is limited to enemy and weapon markers.
- Malformed payloads that resemble `adminAuth` are redacted before inbound
  diagnostics are recorded.
- `adminMap` caps entities at the wire schema limit of 2,048 before encoding.
- Failed admin authentication and authenticated command budgets are now shared
  by peer across reconnects. Forwarded peer addresses are trusted only when
  `TRUST_PROXY=1` is explicitly configured behind a header-scrubbing proxy.
- The portal labels and operations documentation now describe `adminGranted`
  as a persisted role record. Under the local shared-token boundary it cannot
  grant, revoke, or terminate a session; revocation requires rotating
  `ADMIN_TOKEN` and restarting the server.
- **Grant Admin** and **Revoke Admin** now instead operate on a connected
  player's live in-memory role. A verified resume token retains that role;
  stored `clientId` data does not. Revocation clears private debug settings and
  immediately removes in-game admin access, without terminating an unrelated
  token-authenticated portal session.
- Opaque admin-session resume attempts are peer-limited before key resolution,
  and a resume lazily validates its own expiry rather than sweeping all stored
  sessions. Rejected `adminCommand` traffic cannot refresh a normal player's
  gameplay-idle lease.
- `docs/ADMIN-OPERATIONS.md` now states that persisted grants are records, not
  credentials, and that gameplay chat requires a token-authenticated session.

### Follow-up audit fixes and coverage

- An enemy already overlapping a newly held guard is depenetrated to the front
  of the expanded guard boundary instead of remaining embedded or crossing the
  player body.
- Arena leaders now sort ahead of ordinary retained/distance candidates for
  one of the existing three attacker slots. The Orc Warlord can no longer be
  starved indefinitely while all three minions attack.
- Enemy home movement uses the same half-open continuous bounds as arena tile
  placement, so guard separation or wall-side movement cannot strand the Orc
  Warlord in the outer half of a valid arena tile.
- Last-seen pursuit now budgets a twelve-tile detour margin, allowing every
  enemy type to route around longer wall corners before falling back to its
  finite search behavior. The focused route regression covers a wall that
  exceeds the former eight-tile margin.
- The stale higher-terrain occlusion contract was removed from held weapons;
  combat geometry and weapon depth tests assert the intended overlay behavior.
- Cooldown-bar and guard-cone drawing now have focused coverage for ready,
  downed, and blocking hiding, recovery progress, guard-only behavior, yellow
  shield feedback, feedback expiry, one-shot weapon-ready flash lifecycle, and
  the absence of a cooldown attack cone.
- Attack depth coverage verifies multi-row weapon reach in orientation-resolved
  view space, including position following with the spawn-locked profile.
- Minimap terrain reads only already-cached world chunks and invalidates its
  tile cache when the chunk cache or terrain overrides change.
- Stored HUD status dimensions now honor their minimum height when the viewport
  permits, while the minimap retains its square constraint.
- Companion fallback, one-shot behavior presentation, shipped weapon profiles,
  exact hurtboxes, temporal melee windows, multi-hostile cone targeting,
  projectile returns, arena-leader targeting,
  wall-side recovery, minimap legend/marker caps, and off-map landmark
  projection have focused regression coverage.
- Tard's rate-limited green fart now triggers occasionally during a nearby idle
  wait and on a standstill-to-movement transition from either an owner start or
  Tard's own idle wander. The client uses a larger, compact particle burst in a
  visible actor-adjacent depth band, while preserving the replicated one-shot
  event contract.

## Validation status

The final integrated release gate passed on 2026-07-30:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test` — 560 files and 2,393 tests passed
- `git diff --check`

The folder-size check reports only the repository's existing legacy notices,
not a failure. Terraform and OpenTofu are not installed in this workspace, so
the HCL was manually reviewed but `terraform fmt -check` and
`terraform validate` could not run. No Terraform apply was attempted.

## Antagonist review status

- The earlier security/admin Luna XHIGH audit found persisted grants bypassing
  the token, malformed auth diagnostic leakage, and an uncapped map entity
  list. Those findings remain fixed.
- This continuation ran fresh security/admin and gameplay audits at XHIGH
  effort with the available coding-agent model; Luna was not available in the
  current environment. The security audit found reconnect-bypassable rate
  limits and misleading role-revocation semantics. The gameplay audit found
  initial guard overlap, stale depth contracts, and moved-module test mocks.
  Those findings were fixed as described above.
- Because the replacement audits were not Luna runs, do not mark the checklist
  item requiring two antagonist Luna XHIGH reviews complete.

## Known caveats and next work

1. Do not run `npm test` during iteration. After code review and manual
   playtest, run the final gate in this order:

   ```text
   npm run lint
   npm run typecheck
   npm run build
   npm test
   ```

2. Keep manual-playtest checklist items unchecked until Austin verifies them.
3. Austin asked for the integrated release work to be committed after the full
   automated gate so he can playtest it in the morning. Do not push unless he
   separately asks for a push.

## Worktree rules

- Preserve all unrelated dirty changes; this is a large existing release
  worktree, not a clean branch.
- Use `apply_patch` for edits.
- Keep TypeScript modular: no deep nesting, no large monolithic functions, and
  no disabling lint rules.
- Do not reintroduce the old standalone radial block-feedback effect.
- Do not reintroduce automatic admin privilege based solely on `clientId`,
  display name, IP, User-Agent, or browser metadata.
