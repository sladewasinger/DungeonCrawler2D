import { expect, test } from "@playwright/test";
import { holdKey, openGame, readState } from "./helpers.js";

/**
 * Live-browser e2e: a real Chromium drives the real client against a real game-server
 * over real websockets. Join flow, the Epic 7.8 starter kit, and real keyboard movement
 * — the foundation every other spec in this suite builds on.
 */

test.describe("join", () => {
  test("shows the name field and connect button before joining", async ({ page }) => {
    await page.goto("/?debug=1");
    await expect(page.locator("input").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter the Dungeon" })).toBeVisible();
  });

  test("boots, connects, and renders the world (real name field + button, dungeon)", async ({ page }) => {
    const state = await openGame(page, "Joiner", "dungeon");
    expect(state.status).toBe("connected");
    expect(state.playerId).not.toBeNull();
    await expect(page.locator("canvas").first()).toBeVisible();
  });

  test("starter kit: spawns with the Rusty Sword equipped and a full stack of torches", async ({ page }) => {
    const state = await openGame(page, "Kitted", "dungeon");
    expect(state.weapon).toBe("sword");
    const torches = state.inventory.find((s) => s.item === "torch");
    expect(torches?.qty).toBe(3);
    // Weapons auto-equip to the character slot, never the hotbar.
    expect(state.hotbar.includes("sword")).toBe(false);
  });

  test("real keyboard movement actually moves the predicted body", async ({ page }) => {
    const before = await openGame(page, "Walker");
    await holdKey(page, "d", 900);
    const after = await readState(page);
    // A modest margin, not a speed calibration: sandbox's spawn cluster sits close to
    // real generated wall geometry (verified live — movement east from spawn caps out
    // around +3 tiles), so this only proves "real keyboard input moved the predicted
    // body", not a specific tiles/s figure.
    expect(after.x).toBeGreaterThan(before.x + 1);
  });
});
