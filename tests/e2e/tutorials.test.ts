/** Protects starter hotbar onboarding against hydration-only action prompts. */
import { expect, test } from "@playwright/test";
import { openGame } from "./helpers.js";

test("starter tutorials follow actual hotbar selection", async ({ page }) => {
  await openGame(page, "TutorialPicker");
  const tutorial = page.getByRole("status").filter({
    hasText: "select a hotbar item",
  });
  await expect(tutorial).toContainText("Press [1–9]");
  await page.keyboard.press("1");
  await expect(page.getByRole("status")).toContainText(
    "Press [G] to throw the selected item.",
  );
  await page.keyboard.press("2");
  await expect(page.getByRole("status")).toContainText(
    "Press [E] to apply the selected bandage.",
  );
});
