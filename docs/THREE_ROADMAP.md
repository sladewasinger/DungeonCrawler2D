# Three.js Roadmap

The Three.js renderer is a new client shell over the existing deterministic engine and authoritative server. It does not redefine world generation, combat, items, or networking. Its job is to turn the shared world and snapshots into a responsive, readable first-person dungeon.

## Milestone 0 — Playability Baseline

- [x] Remove the placeholder stair blocks; stairs remain terrain data until their true ramp mesh lands.
- [x] Allow a small 0.5-tile step-up; a full tile or taller still requires a jump.
- [x] Treat `Tab` as a game command, never browser focus navigation.
- [x] Return focus to first-person controls after chat submit or Escape.
- [ ] Add a short blocked-movement cue and a landing cue.
- [ ] Define the first-person stair contract: single-tile ramp, collision, mesh, and traversal test share one source of truth.
- [ ] Prevent near-wall camera clipping: the view must not reveal rooms or terrain behind a solid wall when the player approaches it.

## Milestone 1 — Renderer Contract

- [ ] Render only engine height/tile data; no visual-only collision or renderer-owned terrain rules.
- [ ] Build merged terrain meshes by chunk, culling interior faces and exposing only visible facades.
- [ ] Match doors, walls, stairs, pits, and voids to engine collision with fixed-seed visual regression maps.
- [x] Connect the Three.js route to the authoritative session and render interpolated remote-player snapshots.
- [x] Route first-person movement through the shared authoritative input, prediction, reconciliation, collision, and interpolation contracts.
- [ ] Finish snapshot presentation parity: local prediction and animated/interpolated Knight peers are live; enemies, effects, loot, and doors still need the same production rendering and fixed-fixture verification.
- [ ] Keep the Three.js route an opt-in renderer until it reaches feature parity.

## Milestone 2 — First-Person Controls

- [ ] Finish the input-mode state machine. Keyboard/mouse look, touch movement/look, jump, inventory, chat, and settings are live; attack/use parity, remapping, and complete focus-transition coverage remain.
- [ ] Add pointer-lock recovery, focus restoration, remapping, sensitivity, dead-zone, and accessibility settings.
- [ ] Tune jump impulse and collision clearance so a player can jump onto a one-tile ledge without making higher terrain climbable from a standstill.
- [ ] Implement explicit jump arcs and landing against the shared height field; only 0.5-tile or smaller step-up exceptions are allowed.
- [ ] Add configurable coyote time and jump buffering so a jump pressed just after leaving an edge, or just before landing, still feels responsive.
- [ ] Add mobile landscape/portrait layouts and safe-area handling.

## Milestone 3 — Dungeon Perception

- [ ] Finish authored dungeon lighting. Wall sconces and emitted light are live; production shadows, equipped player-held light behavior, and light-budget validation remain.
- [ ] Make view distance a single gameplay/render setting: geometry radius, AOI/entity radius, and distance fog agree.
- [ ] Add fog-of-war presentation without hiding nearby entities at terrain rebuild boundaries.
- [ ] Add occlusion-aware sprite silhouettes and readable enemy/player contrast.
- [ ] Add a restrained atmospheric pass: ambient occlusion, subtle airborne particles, layered fog, and material response that improve depth without obscuring gameplay.

## Milestone 4 — Art, Audio, and Interaction

- [ ] Build materials for gray walkable surfaces, purple cliff/wall facades, pits, voids, stairs, doors, and props.
- [ ] Finish actor presentation. Remote players use textured, animated Knight models; production enemy models/sprites and directional combat feedback remain.
- [ ] Add diegetic torches, doors, loot, blood/effects, impact particles, positional SFX, and dungeon ambience.
- [ ] Support interaction prompts and inventory actions using the existing authoritative intent/event protocol.

## Milestone 5 — HUD OS and Shipping Gates

- [x] Mount one shared HTML/CSS HUD catalog over both Phaser and Three.js: health/status, XP, hotbar, chat tabs, inventory, party, prompts, settings, and HUD Edit Mode all use the same DOM contract.
- [x] Replace the HUD inventory panel with a focused full-screen inventory workspace: an opaque backdrop, category tabs, search/filtering, All/Equipped/Hotbar folders, authoritative item actions, and game-input capture while it is open.
- [ ] Finish account-scoped movable/resizable/pinned layout persistence. Browser-profile persistence, chrome-free normal play, and explicit HUD Edit Mode are live.
- [ ] Add Three.js fixed-seed visual tests for terrain, doors, stairs, light radius, fog, HUD focus, and mobile controls.
- [ ] Profile target devices and enforce an object/triangle/light budget before enabling Three.js by default.

## Milestone 6 — Shared Client Performance Release

- [x] Split renderer entrypoints: dynamically import the Phaser and Three.js shells independently so selecting one renderer does not download the other's runtime. Acceptance: the route shell is 3.3 KB, Phaser and Three are separate lazy chunks, and production builds fail unless the emitted manifest/isolation report proves neither route requests the other renderer runtime.
- [x] Add server spatial entity buckets for AOI snapshots before changing snapshot semantics. Acceptance: one tick-local index preserves exact circular AOI results and legacy ordering; the 10,000-entity benchmark scans 144 nearby candidates (1.44%) and returns the same 81 visible entities as brute force.
- [x] Add backwards-compatible snapshot deltas after spatial buckets: inventory/hotbar only transmit on revision changes and unchanged entities transmit only their stable identity/revision. Legacy full snapshots remain valid, rejected delta chains request a complete baseline, and accepted recovery replaces stale entity, area, inventory, and hotbar state.
- [x] Continue 2D renderer hitch work: transient entity/light/flame synchronization reuses scratch state and bounded spare pools, while the last unbounded atlas-page bake submits at most four wall/cap strips per budget step. Existing fixed-seed drawing and complete-chunk visibility remain unchanged; cancellation releases every partial page, row, image, and emitter.

## Acceptance Rules

1. The engine remains the sole source of geometry, physics, and simulation truth.
2. A player can identify floor, wall, drop, stair, door, enemy, and light source at a glance.
3. Touch, keyboard, mouse, chat, and HUD controls never leak focus to the browser during play.
4. Every renderer change has deterministic fixed-seed coverage plus a manual desktop and mobile check.
5. A performance release advances only after the casual, child, and expert judge passes all agree and the build/bench evidence is recorded.
