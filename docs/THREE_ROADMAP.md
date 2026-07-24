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
- [ ] Define and verify a first-person movement adapter against server collision before routing local movement through shared prediction and reconciliation.
- [ ] Port server snapshots: local predicted player, interpolated peers/enemies, effects, loot, and doors; render peers as scaled billboards from the existing player atlas.
- [ ] Keep the Three.js route an opt-in renderer until it reaches feature parity.

## Milestone 2 — First-Person Controls

- [ ] Finish keyboard/mouse look, touch stick/look pad, jump, attack, use, inventory, chat, and settings as one input-mode state machine.
- [ ] Add pointer-lock recovery, focus restoration, remapping, sensitivity, dead-zone, and accessibility settings.
- [ ] Tune jump impulse and collision clearance so a player can jump onto a one-tile ledge without making higher terrain climbable from a standstill.
- [ ] Implement explicit jump arcs and landing against the shared height field; only 0.5-tile or smaller step-up exceptions are allowed.
- [ ] Add configurable coyote time and jump buffering so a jump pressed just after leaving an edge, or just before landing, still feels responsive.
- [ ] Add mobile landscape/portrait layouts and safe-area handling.

## Milestone 3 — Dungeon Perception

- [ ] Replace debug lighting with authored wall sconces, emitted light, shadows, and a player-held light where equipped.
- [ ] Make view distance a single gameplay/render setting: geometry radius, AOI/entity radius, and distance fog agree.
- [ ] Add fog-of-war presentation without hiding nearby entities at terrain rebuild boundaries.
- [ ] Add occlusion-aware sprite silhouettes and readable enemy/player contrast.
- [ ] Add a restrained atmospheric pass: ambient occlusion, subtle airborne particles, layered fog, and material response that improve depth without obscuring gameplay.

## Milestone 4 — Art, Audio, and Interaction

- [ ] Build materials for gray walkable surfaces, purple cliff/wall facades, pits, voids, stairs, doors, and props.
- [ ] Replace prototype billboards with animated sprite-facing actors and directional combat feedback.
- [ ] Add diegetic torches, doors, loot, blood/effects, impact particles, positional SFX, and dungeon ambience.
- [ ] Support interaction prompts and inventory actions using the existing authoritative intent/event protocol.

## Milestone 5 — HUD OS and Shipping Gates

- [x] Mount one shared HTML/CSS HUD catalog over both Phaser and Three.js: health/status, XP, hotbar, chat tabs, inventory, party, prompts, settings, and HUD Edit Mode all use the same DOM contract.
- [ ] Replace the HUD inventory panel with a focused full-screen inventory workspace: an 80%-opaque backdrop, category tabs, filters, folders, and game-input capture while it is open.
- [ ] Persist movable/resizable/pinned layouts per account; keep normal play chrome-free and HUD Edit Mode explicit.
- [ ] Add Three.js fixed-seed visual tests for terrain, doors, stairs, light radius, fog, HUD focus, and mobile controls.
- [ ] Profile target devices and enforce an object/triangle/light budget before enabling Three.js by default.

## Milestone 6 — Shared Client Performance Release

- [x] Split renderer entrypoints: dynamically import the Phaser and Three.js shells independently so selecting one renderer does not download the other's runtime. Acceptance: the route shell is 3.3 KB, Phaser and Three are separate lazy chunks, and production builds fail unless the emitted manifest/isolation report proves neither route requests the other renderer runtime.
- [x] Add server spatial entity buckets for AOI snapshots before changing snapshot semantics. Acceptance: one tick-local index preserves exact circular AOI results and legacy ordering; the 10,000-entity benchmark scans 144 nearby candidates (1.44%) and returns the same 81 visible entities as brute force.
- [ ] Add backwards-compatible snapshot deltas after spatial buckets: inventory/hotbar only transmit on revision changes and unchanged entities transmit only their stable identity/revision. Acceptance: a legacy full-snapshot client remains valid during rollout, loss/reconnect can recover from a full baseline, and an idle 20 Hz benchmark materially reduces bytes and allocations without stale actors.
- [ ] Continue 2D renderer hitch work: keep pooling transient Phaser visuals and add intra-chunk slicing only when a measured real-device chunk bake exceeds the frame budget. Existing strip-atlas/page pooling and urgency-tiered cross-chunk baking are complete; slicing must preserve pixel output and keep strict-view chunks usable while work is spread across frames.

## Acceptance Rules

1. The engine remains the sole source of geometry, physics, and simulation truth.
2. A player can identify floor, wall, drop, stair, door, enemy, and light source at a glance.
3. Touch, keyboard, mouse, chat, and HUD controls never leak focus to the browser during play.
4. Every renderer change has deterministic fixed-seed coverage plus a manual desktop and mobile check.
5. A performance release advances only after the casual, child, and expert judge passes all agree and the build/bench evidence is recorded.
