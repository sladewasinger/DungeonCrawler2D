/** Verifies native session-menu controls retain keyboard ownership in the 2D route. */
import { expect, test } from "@playwright/test";
import { openGame, readState } from "./helpers.js";

test("2D session controls use native keyboard behavior while blocking gameplay", async ({ page }) => {
  await openGame(page, "SessionNativeControls", "dungeon");
  const gear = page.getByRole("button", { name: "Game menu" });
  const menu = page.locator("[data-session-menu]");
  await gear.click();
  const brightness = page.getByRole("slider", {
    name: "World brightness",
    exact: true,
  });
  const brightnessBefore = Number(await brightness.inputValue());
  await brightness.focus();
  await page.keyboard.press("ArrowRight");
  expect(Number(await brightness.inputValue())).toBeGreaterThan(brightnessBefore);

  await page.getByRole("button", { name: "HUD Edit Mode: OFF" }).click();
  await expect(menu).toBeHidden();
  await gear.click();
  const statusToggle = page.getByRole("checkbox", { name: "Status", exact: true });
  await expect(statusToggle).toBeChecked();
  await statusToggle.focus();
  await page.keyboard.press("Space");
  await expect(statusToggle).not.toBeChecked();

  const before = await readState(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.keyboard.up("w");
  const after = await readState(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.05);
});

test("Escape closes the 2D session menu through the canvas focus fallback", async ({ page }) => {
  await openGame(page, "SessionEscapeFocus", "dungeon");
  const canvas = page.locator("#app canvas").first();
  await canvas.evaluate((element) => {
    element.removeAttribute("tabindex");
    const trigger = document.createElement("button");
    trigger.id = "detached-session-trigger";
    document.body.append(trigger);
    trigger.focus();
  });
  await page.keyboard.press("Escape");
  const menu = page.locator("[data-session-menu]");
  await expect(menu).toBeVisible();
  await page.locator("#detached-session-trigger").evaluate((trigger) => trigger.remove());
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(canvas).toBeFocused();
  await expect(canvas).toHaveAttribute("tabindex", "-1");
});
