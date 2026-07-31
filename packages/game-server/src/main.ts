import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { buildContentRegistry, hashString } from "@dc2d/engine";
import { join } from "node:path";
import { enemiesAreFrozen, voidTerrainIsEnabled } from "./runtime/runtimeOptions.js";
import { startServer } from "./server/index.js";
import { createOperationalEventSink } from "./server/operations/createOperationalEventSink.js";
import { requireOperationalEventPepper } from "./server/operations/operationalConfiguration.js";
import { logServerError } from "./server/operations/structuredServerLog.js";

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
const host = process.env["GAME_HOST"] ?? "0.0.0.0";
const seedInputText = process.env["WORLD_SEED"] ?? "dev-world-1";
const floor = Number(process.env["FLOOR"] ?? 1);
const worldSeed = hashString(seedInputText);
const storeFile =
  process.env["STORE_FILE"] === "none"
    ? null
    : (process.env["STORE_FILE"] ?? join(process.cwd(), "data", "players.json"));

// TEMPORARY friend-playtest tuning: cozy spawns so a small group lands near
// each other instead of scattered across SPAWN_CHUNK_RANGE chunks. Raise
// this (bigger neighborhood) or set SPAWN_RADIUS=0/"off" (classic vast
// MIN_SPAWN_DIST scatter, engine constants) once we want the vast-world
// experience back — this default should not survive to that point.
const DEFAULT_SPAWN_RADIUS_TILES = 2;
const spawnRadiusEnv = process.env["SPAWN_RADIUS"];
const spawnRadiusTiles =
  spawnRadiusEnv === undefined
    ? DEFAULT_SPAWN_RADIUS_TILES
    : spawnRadiusEnv === "0" || spawnRadiusEnv.toLowerCase() === "off"
      ? undefined
      : Number(spawnRadiusEnv);
const freezeEnemies = enemiesAreFrozen(process.env["FREEZE_ENEMIES"]);
const worldFeatures = { voidTerrain: voidTerrainIsEnabled(process.env["VOID_TERRAIN"]) };
const gameplayIdleTimeoutMs = positiveMilliseconds(process.env["GAMEPLAY_IDLE_TIMEOUT_MS"]);
const operationalEventRetentionSeconds = positiveInteger(process.env["OPERATIONAL_EVENT_RETENTION_SECONDS"]);
const operationalEventTable = process.env["OPERATIONAL_EVENT_TABLE"];
const operationalEventPepper = operationalPepper(operationalEventTable, process.env["OPERATIONAL_EVENT_PEPPER"]);
const operationalEvents = createOperationalEventSink({
  ...(operationalEventTable ? { tableName: operationalEventTable } : {}),
  ...(process.env["AWS_REGION"] ? { region: process.env["AWS_REGION"] } : {}),
  ...(operationalEventRetentionSeconds ? { retentionSeconds: operationalEventRetentionSeconds } : {}),
});

// The custom-map / Tile Studio editor is retired. CUSTOM_MAP is accepted by the systemd unit
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
  areaReactions: areaReactionsData as unknown[],
  items: itemsData as unknown[],
  enemies: enemiesData as unknown[],
  recipes: recipesData as unknown[],
});

const server = startServer({
  host,
  port,
  seedInputText,
  worldSeed,
  floor,
  content,
  storeFile,
  clusterSpawns: process.env["CLUSTER_SPAWNS"] === "1",
  spawnRadiusTiles,
  freezeEnemies,
  worldFeatures,
  debugCommands,
  testFixtures: process.env["TEST_FIXTURES"] === "1",
  adminToken: process.env["ADMIN_TOKEN"] ?? null,
  trustProxy: process.env["TRUST_PROXY"] === "1",
  operationalEvents,
  ...(operationalEventPepper ? { operationalEventPepper } : {}),
  ...(gameplayIdleTimeoutMs ? { gameplayIdleTimeoutMs } : {}),
});

console.log(
  // Epic 7.14: the dungeon level now runs floors 1..FLOOR_CAP simultaneously
  // (lazily created) — `floor` only still pins the sandbox level's floor.
  `[game-server] world "${seedInputText}" (seed ${worldSeed}), VOID terrain ${worldFeatures.voidTerrain ? "on" : "off"}, dungeon floors 1..FLOOR_CAP live, sandbox floor ${floor}, listening on ${host}:${port}`,
);

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[game-server] shutting down");
  server.operationalEvents.record({ at: Date.now(), category: "server", action: "shutdown", attributes: { signal } });
  server.stop();
  await server.flushOperationalEvents();
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException", (error) => fatalServerError("uncaught_exception", error));
process.on("unhandledRejection", (error) => fatalServerError("unhandled_rejection", error));

function positiveMilliseconds(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function operationalPepper(tableName: string | undefined, pepper: string | undefined): string | undefined {
  try {
    return requireOperationalEventPepper(tableName, pepper);
  } catch (error) {
    logServerError("operational_configuration", error);
    throw error;
  }
}

function fatalServerError(source: string, error: unknown): void {
  logServerError(source, error);
  server.operationalEvents.record({ at: Date.now(), category: "server", action: source });
  void shutdown("fatal_error", 1);
}
