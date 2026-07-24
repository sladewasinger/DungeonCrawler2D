/** Protects the shared HTML HUD's real browser visibility and resize contracts. */
import { expect, test, type Page } from "@playwright/test";
import { CLIENT_URL, WS_URL } from "./env.js";
import { openGame } from "./helpers.js";

const STATUS_PANEL = '[data-hud-window="three-health"]';
const STORAGE_KEY = "dc2d.three.hud.windows.v2";

const openHudEditor = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "HUD settings" }).click();
  await page.getByRole("button", { name: "HUD Edit Mode: OFF" }).click();
};

test("hidden panels recover their saved size and can be shown again", async ({ page }) => {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 2,
      windows: {
        "three-health": {
          anchor: "top-left", x: 0, y: 0,
          width: 0, height: 0, z: 11, visible: true,
        },
      },
    }));
  }, { key: STORAGE_KEY });
  await openGame(page, "HudVisibility");
  const panel = page.locator(STATUS_PANEL);
  const initial = await panel.boundingBox();
  expect(initial?.width).toBeGreaterThan(100);
  expect(initial?.height).toBeGreaterThan(50);
  await openHudEditor(page);
  const checkbox = page.getByRole("checkbox", { name: "Status", exact: true });
  await checkbox.uncheck();
  await expect(panel).toBeHidden();
  await checkbox.check();
  await expect(panel).toBeVisible();
  const restored = await panel.boundingBox();
  expect(restored?.width).toBe(initial?.width);
  expect(restored?.height).toBe(initial?.height);
});

test("dragging the native resize corner changes size without moving the panel", async ({ page }) => {
  await openGame(page, "HudResize");
  await openHudEditor(page);
  const panel = page.locator(STATUS_PANEL);
  const before = await panel.boundingBox();
  if (!before) throw new Error("status panel has no browser rectangle");
  await page.mouse.move(before.x + before.width - 2, before.y + before.height - 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width + 58, before.y + before.height + 38, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width + 30);
  const after = await panel.boundingBox();
  expect(after?.x).toBeCloseTo(before.x, 0);
  expect(after?.y).toBeCloseTo(before.y, 0);
});

test("the independently loaded Three renderer boots and connects", async ({ page }) => {
  await page.goto(`${CLIENT_URL}/?renderer=three&server=${encodeURIComponent(WS_URL)}`);
  await expect(page.locator("#app canvas")).toBeVisible();
  const telemetry = page.locator('[data-hud-window="three-telemetry"]');
  await expect(telemetry).toContainText("connected", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "HUD settings" })).toBeVisible();
});
