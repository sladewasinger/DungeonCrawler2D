// Shared ports/seed for the e2e suite — one source of truth for playwright.config.ts's
// webServer entries and every spec's helpers.ts import, so the two never drift apart.
// Distinct from the dev-default ports (5173 client / 8787 game-server) on purpose: the
// suite must never collide with a developer's own `npm run dev` running alongside it.

/** Vite dev server port this suite's client runs on. */
export const CLIENT_PORT = 5199;
/** game-server GAME_PORT this suite's server runs on. */
export const GAME_PORT = 8799;
export const WS_URL = `ws://localhost:${GAME_PORT}`;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

/** Fixed WORLD_SEED text (hashed the same way game-server/src/main.ts hashes it) — every
 * spec that needs to reason about world geometry (lightField.ts) recomputes it from this
 * exact string via @dc2d/engine's hashString, never a magic number, so it can never drift
 * from the server's own seed even if this constant is edited later. */
export const WORLD_SEED_TEXT = "e2e-world";
export const FLOOR = 1;

/** TEST_FIXTURES=1's populated chunk range (game-server/src/sim/testzone.ts) covers world
 * tiles [0, 63] on both axes at the default 32-tile CHUNK_SIZE — the slime pit at
 * (20.5, 42.5)/(23.5, 42.5) is the documented e2e combat arena. Sandbox-only: game-server's
 * enemies/population.ts only calls populateTestZoneChunk on the "sandbox" level — a
 * dungeon join gets ordinary random spawns instead (see helpers.ts's openGame doc
 * comment), so every fixture-dependent spec in this suite joins sandbox. */
export const COMBAT_ARENA = { x: 20.5, y: 42.5 };
