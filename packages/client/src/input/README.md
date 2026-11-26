# Client Input & Touch Controls (`packages/client/src/input`)

Unified desktop keyboard/mouse and mobile touch input pipeline:

- `controller.ts`: `InputController` handling WASD/Arrows, hotbar keys, crouch toggle/hold, scroll zoom, mouse aim, browser shortcut guards, and floating virtual thumbstick.
- `inputHelpers.ts` & `inputMode.ts`: Dynamic desktop/touch mode detection, UI click target filtering, and per-frame combat input assembly.
- `mobileCombatControls.ts`: Compact 2-row bottom-right touch cluster (`ATK` context label, `JUMP`, `ROLL`, `SNEAK`, `BLOCK`, `MAP`).
- `autoAim.ts`: Toggleable mobile `100°` forward melee cone snap and `<= 5°` velocity-lead bow aim assist.
- `worldInteractHooks.ts`: Context-aware `[E]` / tap hooks prioritizing chests, loot, and UI modals before forwarding unhandled interacts to the server.
