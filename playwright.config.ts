import { defineConfig } from "@playwright/test";

const GL_LAUNCH_ARGS = process.env.CI || process.env.PW_SWIFTSHADER === "1"
  ? ["--enable-unsafe-swiftshader"]
  : ["--use-gl=angle", "--use-angle=d3d11"];

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: ".verify-reports/playwright.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node scripts/preview-prod.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      WORLD_SEED: "1337",
      PREVIEW_PORT: "4173",
      PREVIEW_GAME_PORT: "4174",
      WORLD_SAVE_PATH: "none",
      ADMIN_TOKEN: "e2e-test-token",
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1280, height: 720 },
        launchOptions: { args: GL_LAUNCH_ARGS },
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        launchOptions: { args: GL_LAUNCH_ARGS },
      },
    },
  ],
});
