# DevTools Admin Console (`client/src/admin/`)

Chrome DevTools console utilities exposed on `window.admin`:

- **Localhost (`localhost`, `127.0.0.1`, `[::1]`)**: Server sessions auto-authorize when `NODE_ENV !== "production"` and `DEBUG_COMMANDS !== "0"`, and the ready banner logs in DevTools. (`?debug=1` / `?admin=1` toolbar/hitbox toggles are strictly limited to localhost origins.)
- **Production (`NODE_ENV=production` / `DEBUG_COMMANDS=0`)**: Silent by default; all privileged packets (`admin`, `debugSpawn`, `setDayPhase`) are rejected server-side unless the session authenticates via `admin.auth("<ADMIN_TOKEN>")` against the server's `ADMIN_TOKEN` (from AWS SSM in prod).

## Commands
- `admin.auth(token)` — Authenticates the active WebSocket session using `ADMIN_TOKEN` (constant-time SHA-256 + `timingSafeEqual` on the server; max 5 failed attempts per connection).
- `admin.help()` — Prints available commands and valid enemy kinds.
- `admin.spawn(kind, count?)` — Spawns 1–10 authoritative enemies (`wolf`, `bear`, `boar`, `spider`, `slime`, `goblin`, `orc`, `skeleton`, `golem`) ahead of the player in the live world.
- `admin.god(enabled?)` — Toggles server-authoritative God Mode (`godMode`, unlimited health and stamina/sprint).
- `admin.heal()` — Restores full HP/stamina and clears poison, burn, bleed, web stickiness, and cocoons.
- `admin.give(itemId, count?)` — Grants stackable or equippable items into your inventory (`torch`, `sword`, `bow`, `arrow`, etc.).
- `admin.clearWebs()` — Clears nearby cobwebs and releases any silk cocoon.
- `admin.time(phaseOrPreset, paused?)` — Jumps and optionally pauses the world Day/Night clock (`dawn`, `day`, `golden`, `dusk`, `night`, or `0..1`).
- `admin.state()` — Returns a compact summary of the local player's vitals/debuffs, `isAdmin` status, and active entity/web counts.
