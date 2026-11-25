/** Boots the authoritative multiplayer overworld server simulation with JSON persistence. */
import { startGameServer } from "./net/wsServer.js";

function resolveBootSavePath(): string | undefined {
  return process.env.WORLD_SAVE_PATH === "none" ? undefined : (process.env.WORLD_SAVE_PATH ?? "data/world-save.json");
}

async function boot(): Promise<void> {
  const server = await startGameServer({ savePath: resolveBootSavePath() });
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[game-server] received ${signal}, flushing persistence and shutting down...`);
    void server.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

boot().catch((err) => {
  console.error("[game-server] failed to start:", err);
  process.exit(1);
});
