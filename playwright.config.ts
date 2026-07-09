import { defineConfig } from "@playwright/test";

/**
 * Live-browser e2e: boots a dedicated game server (CLUSTER_SPAWNS so
 * two browser contexts spawn side by side — real spawns are 80+ tiles
 * apart) and a Vite dev client, then drives the game with real,
 * trusted input events. Run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      command: "npx tsx packages/game-server/src/main.ts",
      port: 8099,
      reuseExistingServer: false,
      env: {
        GAME_PORT: "8099",
        WORLD_SEED: "e2e-world",
        STORE_FILE: "none",
        CLUSTER_SPAWNS: "1",
        DEBUG_COMMANDS: "1",
        TEST_FIXTURES: "1",
      },
    },
    {
      command: "npm run dev -w @dc2d/client",
      port: 5199,
      reuseExistingServer: false,
      env: {
        PORT: "5199",
        VITE_WS_URL: "ws://localhost:8099",
      },
    },
  ],
});
