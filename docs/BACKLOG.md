# DungeonCrawler2D Backlog

This is the ordered execution tracker behind [ROADMAP.md](ROADMAP.md). A checked
roadmap feature requires implementation plus credible automated or measured
evidence. Uncertain work remains open. Player-visible changes must also update the
[Manual Release Checklist](MANUAL_TEST_CHECKLIST.md).

## Status

- **Complete:** implemented and supported by current evidence.
- **In progress:** implementation exists, but required evidence or release work is
  incomplete.
- **Planned:** not started or not yet demonstrated.
- **Conditional:** only execute when an earlier measurement justifies it.

## 1. Networking and Reconciliation

### NET-1 — Actual-server deterministic JSON baseline

- **Status:** Planned; first networking task.
- **Dependencies:** Existing transport metrics, deterministic simulation fixtures,
  and current JSON protocol.
- **Acceptance criteria:**
  - Run scripted deterministic clients against the actual game-server transport,
    not only an isolated simulation or encoder.
  - Capture representative idle, sustained movement, direction-change, jump,
    combat, inventory, chat, AOI-entry, chunk-crossing, loss, reconnect, and
    full-baseline-recovery traffic.
  - Record JSON packet-size distribution and bytes per second per client and in
    aggregate.
  - Record encode and decode cost, server-step duration, socket queued bytes,
    reconciliation error/correction frequency, and input-to-ack latency.
  - Report warm p50/p95/p99/max where meaningful, fixed scenario duration and
    player count, runtime/host details, and deterministic seed.
  - Commit a reproducible benchmark command and a machine-readable baseline
    artifact.
- **Evidence/status:** Synthetic cadence and delta tests plus transport counters
  exist. They are useful prerequisites, but they are not an actual-server baseline.

### NET-2 — Input timeline and acknowledgement contract

- **Status:** Planned.
- **Dependencies:** NET-1 baseline and the existing fixed-rate prediction loop.
- **Acceptance criteria:**
  - Every client movement input carries both a monotonic `seq` and the client's
    projected server tick.
  - The server validates sequence monotonicity and a bounded projected-tick window,
    rejects impossible/stale values safely, and acknowledges accepted progress in
    snapshots.
  - The client restores authoritative movement state and replays only inputs that
    remain unacknowledged.
  - Deterministic tests cover held-input coalescing, release, direction changes,
    jump edges, latency, reordering, packet loss, backpressure, reconnect, and
    wrap/invalid cases without cyclic correction or delayed movement.
  - NET-1 reports input-to-ack latency and correction behavior before and after the
    change.
- **Evidence/status:** Sequence acknowledgement and bounded prediction history are
  complete today. Projected-server-tick transport and validation still need proof.

### NET-3 — Codec assessment from captured packets

- **Status:** Planned; measurement only.
- **Dependencies:** NET-1 representative packet corpus.
- **Acceptance criteria:**
  - Replay the same captured client and server packets through JSON,
    `@msgpack/msgpack`, and a representative Protobuf schema.
  - Compare encoded bytes, encode/decode time, allocations where measurable,
    implementation/schema complexity, browser support, and failure diagnostics.
  - Evaluate cold and warm behavior separately and publish the result alongside
    the JSON baseline.
  - Make an explicit keep-JSON or trial-binary recommendation from measured total
    bandwidth and CPU impact, not packet size alone.
- **Evidence/status:** Not run.
- **Constraint:** Do not implement runtime Protobuf unless this benchmark
  demonstrates an immediate material benefit.

### NET-4 — Conditional negotiated `binary-v1`

- **Status:** Conditional on NET-3.
- **Dependencies:** NET-3 must justify the added protocol and operational cost.
- **Acceptance criteria:**
  - Preserve JSON as the default and fallback throughout any rollout.
  - Negotiate `binary-v1` explicitly during connection setup; never infer it from
    payload shape.
  - Keep mixed JSON/binary clients supported during deployment and rollback.
  - Add cross-codec conformance, malformed-payload, reconnect, baseline-recovery,
    and protocol-mismatch tests.
  - Re-run NET-1 scenarios and demonstrate an end-to-end benefit.
- **Evidence/status:** Not scheduled.
- **Constraint:** No compression now. Small realtime packets do not justify its
  latency, CPU, and complexity without separate evidence.

### NET-5 — Movement and combat latency policy

- **Status:** In progress.
- **Dependencies:** NET-1 and NET-2.
- **Acceptance criteria:**
  - Movement remains server authoritative with local prediction and reconciliation;
    the server never rewinds world movement to accept a past position.
  - Remote movement remains interpolation-first with tightly bounded
    extrapolation.
  - Any future lag compensation or rewind is reserved for combat hit validation,
    is bounded by measured latency, and cannot alter authoritative movement history.
  - Two-client manual routes pass in both renderers on desktop and mobile.
- **Evidence/status:** Current movement/reconciliation tests and diagnostics support
  the policy. Actual-server latency evidence remains NET-1 work.

## 2. Shippable 2D Gameplay and Polish

### GAME-1 — Bandage contract

- **Status:** Complete.
- **Dependencies:** Effects engine, server inventory actions, authoritative status
  snapshots, and shared HUD presentation.
- **Acceptance criteria:**
  - Application heals `+4`, removes bleeding, and emits green positive feedback
    without blood or hit reactions.
  - The refreshed five-second status heals `+2` once per second for five ticks,
    expires at the fifth tick, and never exceeds maximum health.
  - Balance originates from validated versioned tuning data.
  - Both HUDs show authoritative remaining and total duration.
- **Evidence/status:** Covered by content validation, effects/server integration,
  shared health/status presentation, Phaser HUD snapshot, and Three HUD model tests.
  The manual two-renderer route is in
  [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md).

### GAME-2 — Stamina, blocking, sprinting, and recovery

- **Status:** Planned.
- **Dependencies:** Authoritative player stats and shared HUD meters.
- **Acceptance criteria:**
  - Sprinting and held right-mouse blocking spend server-authoritative stamina.
  - Blocking stops only eligible direct projectiles, not explosions or area damage.
  - Stamina recovers while walking and faster while idle.
  - Health regenerates slowly only after a meaningful no-damage delay.
  - Prediction, mobile controls, tooltips, and both HUDs reflect the same state.
- **Evidence/status:** Existing sprint speed is not evidence of a stamina system.

### GAME-3 — Contextual controls and combat readability

- **Status:** Planned.
- **Dependencies:** GAME-2 and shared selected-item/action queries.
- **Acceptance criteria:**
  - Selected usable and throwable items advertise their actual action keys without
    obscuring play.
  - The active weapon advertises attack/block controls only when relevant.
  - Damage, healing, blocking, projectile travel, area effects, and expiration are
    visually distinct at gameplay scale.
  - Blood/splat decals vary by hit and expire within 30 seconds under a bounded
    rendering budget.
- **Evidence/status:** Bandage feedback and the Effects Bench projectile are useful
  foundations; the broader presentation pass is open.

### GAME-4 — 2D art and terrain completion

- **Status:** Planned.
- **Dependencies:** Stable renderer/terrain rules.
- **Acceptance criteria:**
  - Replace placeholder crawler and common-item presentation with cohesive,
    readable four-direction art and distinct ground/inventory icons.
  - Resolve corridor width, minimum pit size, walkable wall-back generation, and
    remaining stair/ledge readability cases.
  - Fixed-seed maps remain collision/render consistent at all camera rotations.
  - Performance does not regress at chunk boundaries.
- **Evidence/status:** Core height rendering and rotation tests exist; final content
  and visual acceptance remain open.

### GAME-5 — Mobile HUD and controls

- **Status:** In progress.
- **Dependencies:** Shared HTML HUD and stable touch-input ownership.
- **Acceptance criteria:**
  - HUD panels move and resize reliably by touch; mobile resize handles are
    unambiguous and selected panels support pinch resizing.
  - Movement, sprint, aim, Attack, Throw, Use, and Jump targets are reachable,
    non-overlapping, and visually responsive.
  - Chat/inventory capture input; fullscreen has an explicit user-gesture path.
  - Landscape layouts pass representative phone and tablet viewport checks.
- **Evidence/status:** Shared mobile controls and fullscreen paths exist. Final
  ergonomics require manual device evidence.

## 3. Descent, Progression, and Social Systems

### WORLD-1 — Complete The Descent

- **Status:** In progress.
- **Dependencies:** Stable movement/networking and floor persistence.
- **Acceptance criteria:**
  - Stair traversal, floor entry/exit, boss gates, difficulty, death destinations,
    and progression persistence form one deterministic loop.
  - Reconnect and party transitions preserve the correct floor and objective state.
  - Every floor has readable identity and an escapable generated route.
- **Evidence/status:** Multiple floors, stairs, boss foundations, and generation
  invariants exist. The complete progression loop is not yet proven.

### SOCIAL-1 — Finished party and moderation UX

- **Status:** In progress.
- **Dependencies:** Existing party/chat/contact authority and shared HUD.
- **Acceptance criteria:**
  - Explicit invite, accept/decline, membership, leader/leave, disconnected, revive,
    and directional-member states are clear and keyboard/touch accessible.
  - Mute/block/report controls apply consistently across global, local, party, DM,
    presence, and invite surfaces.
  - Reconnect cannot duplicate or strand social state.
- **Evidence/status:** Core party, chat, contacts, revive, directional indicators,
  rate limits, and reconnect continuity exist. Complete moderation and management UX
  remains open.

### META-1 — Accounts, progression, and invention economy

- **Status:** Planned.
- **Dependencies:** WORLD-1, SOCIAL-1, persistence policy, and moderation policy.
- **Acceptance criteria:**
  - Account and character progression is durable, migration-safe, and recoverable.
  - AI-created items pass validation, moderation, balance, provenance, and global
    registry rules before becoming craftable.
  - Player-facing failure and rollback paths are explicit.
- **Evidence/status:** Design and isolated foundations exist; production system is
  not complete.

## 4. Practical Three.js Parity

### THREE-1 — Gameplay parity without server divergence

- **Status:** In progress.
- **Dependencies:** Stable shared engine/server contracts and each corresponding 2D
  gameplay feature.
- **Acceptance criteria:**
  - Three.js uses the same authoritative movement, combat, effects, inventory,
    interaction, party, chat, reconnect, and floor state as 2D.
  - Differences remain presentation/input adapters, not duplicate gameplay rules.
  - Parity regressions have focused code coverage and a concise manual route.
- **Evidence/status:** Shared protocol, remote player models, HUD, chat, mobile input,
  and core movement exist. Full feature and effects parity remains open.

### THREE-2 — First-person atmosphere and movement polish

- **Status:** Planned.
- **Dependencies:** NET-1 measurements and THREE-1 correctness.
- **Acceptance criteria:**
  - Camera near-plane/wall handling never reveals hidden geometry.
  - Jump height, coyote time, step height, fog, lighting, ambient depth, particles,
    and view distance are tuned from stable frame budgets.
  - Sconces/lights and remote actors do not disappear at chunk or distance
    boundaries.
- **Evidence/status:** Prototype lighting, fog, models, and controls exist; final
  polish and measured budgets do not.

## 5. Production and Release

### RELEASE-1 — Quality and accessibility

- **Status:** In progress.
- **Dependencies:** Stable feature slices.
- **Acceptance criteria:**
  - Automated tests protect high-value invariants and fail when their fixes are
    removed; obsolete or duplicate tests are pruned.
  - Accessibility settings, keyboard/touch ownership, onboarding, and release notes
    are complete.
  - The manual checklist stays short, current, and risk ordered.
- **Evidence/status:** Typecheck/lint/build/test gates and a living manual checklist
  exist. Final accessibility/onboarding/release-note coverage remains open.

### RELEASE-2 — Load, deployment, and operations

- **Status:** Planned.
- **Dependencies:** NET-1, WORLD-1, SOCIAL-1, and release-candidate content.
- **Acceptance criteria:**
  - Representative concurrency/load tests meet simulation, network, memory, and
    reconnect budgets.
  - Production deployment is monitored, versioned, rollback-capable, and has
    actionable client/server diagnostics.
  - Moderation, backup/recovery, abuse response, and post-release ownership are
    documented and exercised.
- **Evidence/status:** Deployment and diagnostics foundations exist; launch
  operations are not complete.

