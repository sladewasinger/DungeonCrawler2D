# `@dc2d/game-server`

Authoritative 20 Hz multiplayer server built on Node + `ws`:
- Evaluates infinite deterministic terrain via `@dc2d/engine`
- Drives authoritative 3-phase melee combat (`src/sim/combat/meleeTimeline.ts`, `statusEffects.ts` burn/venom poison DoT & water extinguish, heavy hold guard-break, timed parry -> `1.75×` riposte, spear shield-poke, pickaxe armor-crush + AoE slam, `0.18s` input buffer, windup dodge-cancel), dynamic spring-cloth webs & silk cocoons (`src/sim/webs/`), ecological wildlife AI (`src/sim/wildlife/`), synced Day/Night clock, and POI chests/loot
- Enforces server-side admin/debug authorization (`src/net/adminAuth.ts`, `wsServer.ts`): open only on non-production builds without `DEBUG_COMMANDS=0`, or per-session in production after constant-time `ADMIN_TOKEN` authentication (`admin` / `debugSpawn` / `setDayPhase`)
- Broadcasts snapshots over WebSocket and bundles to `dist/main.cjs`
