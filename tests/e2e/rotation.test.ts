import { expect, test } from "@playwright/test";
import { openGame } from "./helpers.js";

/**
 * LANE W2 gate item (4): live camera rotation actually does something real. Physical
 * keys are Q (ccw) / X (cw) — not literal Q/E — since E already owns Interact
 * (docs/ASSUMPTIONS.md logs the deviation from the row-252-convention's literal "E").
 */
test.describe("camera rotation (Q/X)", () => {
  test("Q rotates the compass + terrain, X rotates it back — no console errors either way", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await openGame(page, "Rotator");
    expect(await page.evaluate(() => window.__dc2d!.viewOrientation())).toBe(0);

    const before = await page.screenshot();
    await page.keyboard.press("q");
    // Settles well past the ~250ms tween + the hard swap's incremental chunk re-bake.
    await page.waitForFunction(() => window.__dc2d!.viewOrientation() === 270, undefined, { timeout: 2_000 });
    await page.waitForTimeout(200);
    const mid = await page.screenshot();
    expect(mid.equals(before), "a real terrain/entity pixel actually moved after rotating").toBe(false);

    await page.keyboard.press("x");
    await page.waitForFunction(() => window.__dc2d!.viewOrientation() === 0, undefined, { timeout: 2_000 });
    await page.waitForTimeout(200);

    expect(errors, `no console errors across the rotation round-trip, got: ${errors.join(" | ")}`).toEqual([]);
  });
});
