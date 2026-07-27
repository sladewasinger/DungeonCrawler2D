# DungeonCrawler2D Roadmap

This is the high-level order of work. Execution detail, acceptance criteria, and
evidence live in [BACKLOG.md](BACKLOG.md). Player-facing checks live in the
[Manual Release Checklist](MANUAL_TEST_CHECKLIST.md). The previous long-form
roadmap is preserved in
[ROADMAP-legacy-through-2026-07-24.md](archive/ROADMAP-legacy-through-2026-07-24.md).

## Epic 1 — Networking and Movement

### Features

- [x] Server-authoritative 20 Hz movement with client prediction, reconciliation,
  remote interpolation, and bounded extrapolation.
- [x] Adaptive input/snapshot cadence, transactional snapshot delivery, revisioned
  deltas, full-baseline recovery, reconnect continuity, and transport diagnostics.
- [x] Establish an actual-server deterministic JSON benchmark and input-to-ack
  timing baseline.
- [x] Add projected-server-tick input acknowledgement and prove clean replay of
  unacknowledged inputs under latency, loss, and backpressure.
- [x] Benchmark representative JSON, MessagePack, and Protobuf packets before
  deciding whether a negotiated binary protocol is worthwhile.
- [x] Tune and load-test from measured frame, simulation, transport, and correction
  budgets.

## Epic 2 — Shippable 2D Gameplay

### Features

- [x] Deterministic heightmapped dungeon generation, chasms, stairs, collision,
  chunk streaming, and camera rotation.
- [x] Server-authoritative effects, inventory, hotbar, weapons, throwables,
  crafting, enemies, PvE/PvP combat, death, and respawn foundations.
- [x] Bandages heal `+4` immediately and `+2` once per second for five seconds,
  refresh authoritatively, clamp at maximum health, and share readable feedback
  across both renderers.
- [x] Shared HTML HUD foundation with chat, inventory workspace, hotbar, status
  effects, compass, party information, and editable layout.
- [x] Finish stamina-backed sprinting and blocking, delayed health regeneration,
  contextual action help, and combat-readability polish.
- [ ] Finish cohesive four-direction character art, item/effect readability,
  terrain-generation decisions, and remaining 2D content polish.
- [ ] Remove the blanket 2× world-generation expansion: use direct 32×32 chunks,
  widen room and avenue corridors in the generator, and make stairs one tile;
  follow [WORLDGEN-SCALE-REMOVAL.md](WORLDGEN-SCALE-REMOVAL.md).
- [ ] Complete touch HUD editing and mobile action-layout ergonomics.

## Epic 3 — Descent, Progression, and Social Play

### Features

- [x] Parties, party chat, local/global chat, contacts, safe rooms, shared stash,
  crafting, and reconnect-preserved social state.
- [x] Finish floor identity, stair traversal edge cases, bosses, difficulty,
  progression persistence, and death destinations.
- [ ] Finish explicit party management, presence/moderation controls, accounts,
  meta progression, and the invention/crafting economy.

## Epic 4 — Practical Three.js Parity

### Features

- [x] Optional first-person Three.js client on the same engine, server, protocol,
  world, chat, and shared HTML HUD.
- [x] Networked remote-player models, basic animation, pointer/mobile look,
  movement, jumping, fullscreen controls, and reconnect support.
- [ ] Close remaining gameplay, effects, inventory, lighting, interaction, and
  mobile parity gaps without slowing the primary 2D release path.
- [ ] Add measured atmosphere, camera-wall safety, view-distance tuning, and
  first-person movement polish.

## Epic 5 — Production Release

### Features

- [ ] Complete accessibility, onboarding, settings, release notes, and versioning.
- [ ] Complete balance/content passes, art/audio/juice, moderation, and abuse
  controls.
- [ ] Pass deterministic regression, load, reconnect, browser/device, and manual
  release gates.
- [ ] Deploy a monitored public build with rollback and post-release diagnostics.
