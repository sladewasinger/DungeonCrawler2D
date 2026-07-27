# Shared HUD templates

The Phaser 4 and Three.js routes use the same browser HUD implementation in
`packages/client/src/ui/hud`. Static markup lives in feature-sliced HTML
templates and static presentation lives in feature-sliced CSS. The template
registry imports those files with Vite's `?raw` loader and clones the requested
`<template>` at runtime.

## Where to edit

- `ui/hud/templates/core.html` — root, reticle, compass, status, telemetry,
  weapon, window, and reusable controls.
- `ui/hud/templates/panels.html` — hotbar, buffs, chat, contacts, crafting,
  stash, settings, and empty states.
- `ui/hud/templates/inventory.html` — inventory shell and item rows.
- `ui/hud/templates/social.html` — party tracker and invite views.
- `ui/hud/templates/feedback.html` — notices, boss bar, downed state, health
  feedback, and tutorials.
- `ui/hud/templates/touch.html` — mobile stick, action buttons, and bag button.
- `ui/hud/templates/session.html` — pause/session menu shells and settings
  headings.

The matching files in `ui/hud/styles/` contain the CSS slices. `ui/hud.css`
is only the import entry point and should stay small.

## Runtime boundary

Components may update text, state attributes, CSS custom properties, progress
values, and geometry in TypeScript. They should not recreate static HUD shells
or put static colors, spacing, typography, or layout in `style.cssText`.

When adding a template:

1. Give the root a unique `<template id="...">`.
2. Mark dynamic leaves with a `data-hud-*` attribute.
3. Clone it with `createHudTemplate` and resolve required leaves with
   `requireHudElement`.
4. Put its default presentation in the corresponding CSS slice.
5. Keep event listeners and authoritative state updates in the component.

The registry validates duplicate template IDs in the browser. Its small DOM
fallback exists only for the repository's node-based unit-test fakes; it is not
used by the game runtime.
