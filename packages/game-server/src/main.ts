import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { buildContentRegistry, hashString } from "@dc2d/engine";
import { join } from "node:path";
import { startServer } from "./server.js";

/**
 * Standalone game-server entry point. Locally this runs next to the
 * client dev server (deliberately the same topology as production,
 * where this process lives on the EC2 box behind CloudFront and the
 * client is static files) — only the ws URL differs.
 */

// GAME_PORT (not PORT) so generic tooling that injects PORT for the
// web client can't accidentally re-home the websocket server.
const DEV_DEFAULT_PORT = 8787;
const port = Number(process.env["GAME_PORT"] ?? DEV_DEFAULT_PORT);
const seedText = process.env["WORLD_SEED"] ?? "dev-world-1";
const floor = Number(process.env["FLOOR"] ?? 1);
const worldSeed = hashString(seedText);
const storeFile =
  process.env["STORE_FILE"] === "none"
    ? null
    : (process.env["STORE_FILE"] ?? join(process.cwd(), "data", "players.json"));

// TEMPORARY friend-playtest tuning: cozy spawns so a small group lands near
// each other instead of scattered across SPAWN_CHUNK_RANGE chunks. Raise
// this (bigger neighborhood) or set SPAWN_RADIUS=0/"off" (classic vast
// MIN_SPAWN_DIST scatter, engine constants) once we want the vast-world
// experience back — this default should not survive to that point.
const DEFAULT_SPAWN_RADIUS_TILES = 50;
const spawnRadiusEnv = process.env["SPAWN_RADIUS"];
const spawnRadiusTiles =
  spawnRadiusEnv === undefined
    ? DEFAULT_SPAWN_RADIUS_TILES
    : spawnRadiusEnv === "0" || spawnRadiusEnv.toLowerCase() === "off"
      ? undefined
      : Number(spawnRadiusEnv);

// custom-map / Tile Studio editor was dropped from the v2 core slice
// (see docs/PORT_PLAN.md); CUSTOM_MAP is accepted by the systemd unit
// for compatibility but has no effect here.
if (process.env["CUSTOM_MAP"] && process.env["CUSTOM_MAP"] !== "none") {
  console.log(`[game-server] CUSTOM_MAP is set but ignored — custom maps are not part of v2 yet`);
}

// Dev harness (god mode, teleport): on for local dev and tests, and
// HARD OFF under NODE_ENV=production regardless of DEBUG_COMMANDS.
const debugCommands =
  process.env["NODE_ENV"] !== "production" && process.env["DEBUG_COMMANDS"] !== "0";

// RawContent wants mutable arrays; content JSON exports are readonly by
// design (never mutated) so this is a type-only widen, not a data risk.
const content = buildContentRegistry({
  statuses: statusesData as unknown[],
  rules: rulesData as unknown[],
  areas: areasData as unknown[],
  items: itemsData as unknown[],
  enemies: enemiesData as unknown[],
  recipes: recipesData as unknown[],
});

const server = startServer({
  port,
  worldSeed,
  floor,
  content,
  storeFile,
  clusterSpawns: process.env["CLUSTER_SPAWNS"] === "1",
  spawnRadiusTiles,
  debugCommands,
  testFixtures: process.env["TEST_FIXTURES"] === "1",
});

console.log(
  `[game-server] floor ${floor} of world "${seedText}" (seed ${worldSeed}) listening on ws://localhost:${port}`,
);

function shutdown(): void {
  console.log("[game-server] shutting down");
  server.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
