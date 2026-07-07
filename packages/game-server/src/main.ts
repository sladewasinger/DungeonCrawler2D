import { content } from "@dc2d/content";
import { customMapSchema, hashString, setCustomMap } from "@dc2d/engine";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startServer } from "./server";

/**
 * Standalone game-server entry point. Locally this runs next to the
 * Vite dev server (`npm run dev` at the repo root starts both) —
 * deliberately the same topology as production, where this process
 * lives on the EC2 box behind Caddy and the client is static files
 * on CloudFront. Only the ws URL differs.
 */

// GAME_PORT (not PORT) so generic tooling that injects PORT for the
// web client can't accidentally re-home the websocket server.
const port = Number(process.env.GAME_PORT ?? 8081);
const seedText = process.env.WORLD_SEED ?? "dev-world-1";
const floor = Number(process.env.FLOOR ?? 1);
const worldSeed = hashString(seedText);
const storeFile =
  process.env.STORE_FILE === "none"
    ? null
    : (process.env.STORE_FILE ?? join(process.cwd(), "data", "players.json"));

// Tile Studio map stamp (tools/tile-studio/): the client fetches the
// same file from its public dir, so both sides generate identically.
const customMapFile =
  process.env.CUSTOM_MAP ?? join(process.cwd(), "..", "client", "public", "assets", "custom-map.json");
if (process.env.CUSTOM_MAP !== "none" && existsSync(customMapFile)) {
  const def = customMapSchema.parse(JSON.parse(readFileSync(customMapFile, "utf8")));
  setCustomMap(def);
  console.log(
    `[game-server] custom map "${customMapFile}" stamped at (${def.origin.x}, ${def.origin.y}) ${def.width}×${def.height}`,
  );
}

const server = startServer({
  port,
  worldSeed,
  floor,
  content,
  storeFile,
  clusterSpawns: process.env.CLUSTER_SPAWNS === "1",
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
