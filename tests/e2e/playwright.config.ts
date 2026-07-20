// Playwright config for the committed e2e suite (docs/ROADMAP.md Epic 7.12): boots a
// real game-server + real vite client, drives real Chromium against them, tears both
// down after. Run via `npm run e2e` from the repo root — deliberately NOT wired into
// the deploy workflow yaml; the orchestrator decides CI placement (see the lane brief).
import { defineConfig } from "@playwright/test";
import { CLIENT_PORT, CLIENT_URL, GAME_PORT } from "./env.js";

const STARTUP_TIMEOUT_MS = 30_000;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.test.ts",
  // Every spec shares one live game-server sim (deterministic fixed seed/fixtures) — as
  // in v1's e2e suite, scenarios run serially against it rather than in parallel workers,
  // so one spec's world state (a killed fixture, a placed torch) can't race another's.
  fullyParallel: false,
  workers: 1,
  retries: 0, // no retry masking: a flake is a finding, in CI too
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: CLIENT_URL,
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: "npm run dev -w @dc2d/game-server",
      port: GAME_PORT,
      reuseExistingServer: false, // an already-listening server has UNKNOWN env (seed/fixtures) — reusing one made the suite test a stale orphan; always boot fresh
      timeout: STARTUP_TIMEOUT_MS,
      stdout: "pipe",
      env: {
        GAME_PORT: String(GAME_PORT),
        WORLD_SEED: "e2e-world",
        FLOOR: "1",
        // Fixed fixtures at spawn (starter items, the slime-pit combat arena) instead
        // of a purely random population — the deterministic anchor every spec walks to.
        TEST_FIXTURES: "1",
        // Clustered spawns so two joining clients land within AOI/fistbump range of
        // each other, same tuning main.ts's own dev default already uses.
        CLUSTER_SPAWNS: "1",
        // Memory-only store: nothing written to disk, no cross-run pollution.
        STORE_FILE: "none",
        DEBUG_COMMANDS: "1",
      },
    },
    {
      command: `npm run dev -w @dc2d/client -- --port ${CLIENT_PORT} --strictPort`,
      port: CLIENT_PORT,
      reuseExistingServer: false, // an already-listening server has UNKNOWN env (seed/fixtures) — reusing one made the suite test a stale orphan; always boot fresh
      timeout: STARTUP_TIMEOUT_MS,
      stdout: "pipe",
    },
  ],
});
