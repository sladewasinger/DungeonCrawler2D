# `@dc2d/engine`

Tier-3 platform-free, deterministic core simulation rules (`zod`, `@dc2d/contracts`, and `@dc2d/content` only; zero Node built-ins and zero renderer imports):

## Architecture & Directories
| Directory | Covers |
| --- | --- |
| [`src/world/`](./src/world/README.md) | Seeded `32×32` chunk generation, 5 macro biomes, 20 POIs, sliding collision, jump physics, prop footprints |
| [`src/combat/`](./src/combat/README.md) | `COMBAT_TUNING`, stealth visibility, AI perception & A*, gait clock, weapon movesets, hurtbox/hitbox math |
| [`src/inventory/`](./src/inventory/README.md) | True 36-slot inventory operations, armor slots, aggregated gear stats/perks, and crafting validation |
| [`src/survival/`](./src/survival/README.md) | Tool-gated resource harvesting, camp structures (`STRUCTURE_SPECS`), survival buffs, and `WorldDeltaOverlay` |
| [`src/character/`](./src/character/README.md) | Modular appearance Zod schemas, sanitization, and `18` hair colors (solid + two-tone gradients) |
| [`src/net/`](./src/net/README.md) | Authoritative `PROTOCOL_VERSION = 1` Zod wire schemas, chat, discovery, deltas, and world events |
| `src/math/`, `src/time/` | Seeded 2D value/fBm/ridge noise and synced `480s` Day/Night lighting curve sampling |
