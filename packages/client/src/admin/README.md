# DevTools Admin Console (`client/src/admin/`)

Localhost / `?admin=1` / `?debug=1` Chrome DevTools console utilities exposed as `window.admin`:

- `admin.help()` — Prints available commands and valid enemy kinds.
- `admin.spawn(kind, count?)` — Spawns 1–10 authoritative enemies (`wolf`, `bear`, `boar`, `spider`, `slime`, `goblin`, `orc`, `skeleton`, `golem`) ahead of the player in the live world.
- `admin.god(enabled?)` — Toggles server-authoritative God Mode (`godMode`, unlimited health and stamina/sprint).
- `admin.heal()` — Restores full HP/stamina and clears poison, burn, bleed, web stickiness, and cocoons.
- `admin.give(itemId, count?)` — Grants stackable or equippable items into your inventory (`torch`, `sword`, `bow`, `arrow`, etc.).
- `admin.clearWebs()` — Clears nearby cobwebs and releases any silk cocoon.
- `admin.time(phaseOrPreset, paused?)` — Jumps and optionally pauses the world Day/Night clock (`dawn`, `day`, `golden`, `dusk`, `night`, or `0..1`).
- `admin.state()` — Returns a compact summary of the local player's vitals/debuffs and active world entity/web counts.
