/** Protects the shared HTML HUD's real browser visibility and resize contracts. */
import { expect, test, type Page } from "@playwright/test";
import { CLIENT_URL, WS_URL } from "./env.js";
import { openGame, readState } from "./helpers.js";

const STATUS_PANEL = '[data-hud-window="three-health"]';
const STORAGE_KEY = "dc2d.three.hud.windows.v2";

const openHudEditor = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Game menu" }).click();
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
  await page.getByRole("button", { name: "Game menu" }).click();
  const checkbox = page.getByRole("checkbox", { name: "Status", exact: true });
  await checkbox.uncheck();
  await expect(panel).toBeHidden();
  await checkbox.check();
  await expect(panel).toBeVisible();
  const restored = await panel.boundingBox();
  expect(restored?.width).toBe(initial?.width);
  expect(restored?.height).toBe(initial?.height);
});

test("the HUD edit grip resizes without moving the panel", async ({ page }) => {
  await openGame(page, "HudResize");
  await openHudEditor(page);
  const panel = page.locator(STATUS_PANEL);
  const grip = panel.locator("[data-hud-resize-grip='true']");
  await expect(grip).toBeVisible();
  const before = await panel.boundingBox();
  const gripBounds = await grip.boundingBox();
  if (!before || !gripBounds) throw new Error("status panel has no edit geometry");
  await page.mouse.move(
    gripBounds.x + gripBounds.width / 2,
    gripBounds.y + gripBounds.height / 2,
  );
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

test("inventory is a modal workspace that blocks 2D world input", async ({ page }) => {
  await openGame(page, "InvWorkspace");
  await page.waitForTimeout(200);
  await page.keyboard.press("Tab");
  const inventory = page.locator("[data-inventory-workspace]");
  await expect(inventory).toBeVisible();
  await expect(inventory.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("sword");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusedAction = await page.evaluate(() =>
    document.activeElement?.textContent?.trim().toLocaleLowerCase() ?? "");
  expect(focusedAction).toBe("unequip");
  await page.keyboard.press("Enter");
  await expect(inventory.getByRole("button", { name: "equip", exact: true }))
    .toBeVisible();
  const viewport = page.viewportSize();
  const bounds = await inventory.boundingBox();
  if (!viewport || !bounds) throw new Error("inventory workspace has no viewport bounds");
  expect(bounds.width).toBeGreaterThan(viewport.width * 0.95);
  expect(bounds.height).toBeGreaterThan(viewport.height * 0.95);
  await page.keyboard.press("Enter");
  await page.keyboard.press("o");
  await expect(page.locator('[data-hud-window="three-contacts"]')).toBeHidden();
  const activePlaceholder = await page.evaluate(() =>
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.placeholder
      : "");
  expect(activePlaceholder).not.toBe("press Enter to chat");
  const before = await readState(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.up("w");
  const after = await readState(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.05);
  await page.keyboard.press("Escape");
  await expect(inventory).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-session-menu]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Respawn (die)" })).toBeEnabled();
  await expect(page.getByText("World brightness")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(inventory).toBeHidden();
  await page.keyboard.press("i");
  await expect(inventory).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-session-menu]")).toBeHidden();
});

test("the session menu contains focus and leaves background controls inert", async ({ page }) => {
  await openGame(page, "SessionFocus");
  const menu = page.locator("[data-session-menu]");
  const resume = menu.getByRole("button", { name: "Resume" });
  const gear = page.locator("button[aria-label='Game menu']");
  const canvas = page.locator("#app canvas").first();
  await gear.click();
  await expect(menu).toBeVisible();
  await expect(resume).toBeFocused();
  await expect(gear).toHaveAttribute("aria-hidden", "true");
  expect(await gear.evaluate((element) => element.inert)).toBe(true);
  expect(await canvas.evaluate((element) => element.inert)).toBe(true);
  await gear.focus();
  await expect(resume).toBeFocused();
  const finalControl = menu.getByRole("button", { name: "Enter Full Screen" });
  await page.keyboard.press("Shift+Tab");
  await expect(finalControl).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(resume).toBeFocused();
  await resume.focus();
  await page.keyboard.press("Space");
  await expect(menu).toBeHidden();
  await expect(gear).not.toHaveAttribute("aria-hidden", "true");
  expect(await gear.evaluate((element) => element.inert)).toBe(false);
  expect(await canvas.evaluate((element) => element.inert)).toBe(false);
  await expect(gear).toBeFocused();
});

test("the independently loaded Three renderer boots and connects", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(
    `${CLIENT_URL}/?renderer=three&server=${encodeURIComponent(WS_URL)}`,
    { waitUntil: "domcontentloaded" },
  );
  await page.getByRole("button", { name: "Enter the Dungeon" }).click();
  const telemetry = page.locator('[data-hud-window="three-telemetry"]');
  await expect(telemetry).toContainText("connected", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Game menu" })).toBeVisible();
  await page.keyboard.press("Tab");
  const inventory = page.locator("[data-inventory-workspace]");
  await expect(inventory.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("sword");
  for (let index = 0; index < 4; index++) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const equipButton = inventory.getByRole("button", { name: "equip", exact: true });
  await expect(equipButton).toBeVisible();
  await equipButton.focus();
  await page.keyboard.press("Space");
  await expect(inventory.getByRole("button", { name: "unequip", exact: true }))
    .toBeVisible();
  await page.keyboard.press("Escape");
  await expect(inventory).toBeHidden();
  const menu = page.locator("[data-session-menu]");
  const resume = menu.getByRole("button", { name: "Resume" });
  const gear = page.getByRole("button", { name: "Game menu" });
  await gear.click();
  await expect(resume).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await gear.click();
  await expect(resume).toBeFocused();
  await page.keyboard.press("Space");
  await expect(menu).toBeHidden();
  await gear.click();
  await page.getByRole("button", { name: "Quit to opening screen" }).click();
  await page.getByRole("button", { name: "Confirm quit" }).click();
  await expect(page.getByRole("button", { name: "Enter the Dungeon" })).toBeVisible();
});
