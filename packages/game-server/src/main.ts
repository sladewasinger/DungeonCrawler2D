import { hashString } from "@dc2d/engine";
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

const server = startServer({ port, worldSeed, floor });

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
