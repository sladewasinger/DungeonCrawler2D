# Manual Release Checklist

Use this for the next browser playtest after pulling a release candidate. Check the
highest-risk items first; stop and report the first reproducible failure with renderer,
browser/device, seed, floor, and exact steps.

## Current release candidate

- [ ] **Chat captures gameplay keys:** Join either renderer, press Enter, type `tab q x 1 e g i`, and submit or press Escape. **Expected:** the characters are entered into chat only; no inventory, hotbar, use, throw, rotation, or other gameplay action fires while the input owns focus. After submit/Escape, game controls work again.
- [ ] **Inventory toggles reliably:** With game input active, press Tab to open inventory, then Tab again; repeat with I and Escape. **Expected:** each toggle opens and closes the full-screen inventory without browser focus traversal or a stranded input state.
- [ ] **Inventory works in both renderers:** In 2D and Three mode, open inventory, search/filter, use one item, drop one from a stack, equip a weapon, and bind an item to a hotbar slot. **Expected:** actions are responsive, state persists after closing/reopening, and gameplay keys are blocked only while the workspace is open.
- [ ] **Compass is present and correct:** In 2D and Three mode, verify the compass is visible, turn through all cardinal directions, and locate stairs. **Expected:** cardinal labels/tick rotate with heading and the gold stair tick consistently points toward the stair destination.
- [ ] **Rotation controls respect text entry:** Outside chat use Q/X to rotate the 2D camera. Then focus chat and type Q/X. **Expected:** rotation works only while game input is active; letters remain text while typing.
- [ ] **Starter hotbar and tutorials are contextual:** Start a fresh character, then reconnect, respawn, and customize the hotbar. **Expected:** torch begins in slot 1 and bandage in slot 2 without overwriting later custom bindings; no inventory/low-health tutorial appears at initial load; relevant tutorial appears only after the triggering pickup, selection, or post-load low-health change.
- [ ] **Bandage healing is readable and authoritative:** In both 2D and Three mode, lose at least 14 HP, apply a bandage, and watch the buff through expiry; apply another midway through once. **Expected:** each application shows green `+4` feedback with no blood/hit reaction, the Bandaged buff refreshes to 5 seconds, five `+2` heals follow one per second, the buff expires after the fifth tick, and HP never exceeds max.
- [ ] **Network movement remains smooth:** Open two clients in both 2D and Three mode. Hold one movement direction for at least 10 seconds, release it cleanly, repeat with direction changes and jumping, cross chunk boundaries, briefly background one tab, reconnect it, and observe the other client throughout. **Expected:** local movement stays immediate; releasing input stops without overshoot, cyclic correction, or a delayed extra step; remote actors move smoothly without drift/teleports; reconnect preserves identity/state; and no renderer-specific desync appears.
- [ ] **Spitter projectile is visible:** In the Effects Bench, spawn/enable a Spitter and let it attack the dummy. **Expected:** wind-up precedes a visible projectile travelling from the Spitter to the target; replacing an area effect with the same id but a different kind updates its visual instead of leaving a stale rig.
- [ ] **Torch flow and lighting:** Select the starter torch, throw it with G, inspect the landed light, then pick it up if possible. **Expected:** the selected slot is clear, G launches the torch, landing produces a persistent visible light in both renderers, and pickup/burnout removes that light cleanly.
- [ ] **Mobile controls:** On a touch-sized viewport, move/aim, jump/use/throw, open/close inventory and chat, enter HUD Edit Mode, move/resize a panel, and use fullscreen. **Expected:** controls have reachable non-overlapping targets; chat and inventory capture input; HUD touch editing works; fullscreen works from its explicit control.

## Maintenance rule

For every player-visible change, append or adjust a manual check here at the same time
as its automated regression coverage. Remove checks once the covered behavior is truly
obsolete; do not retain stale ritual tests.
