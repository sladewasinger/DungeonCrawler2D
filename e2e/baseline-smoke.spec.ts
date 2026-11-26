/** Baseline real-browser smoke & FPS-cliff check for Desktop and Mobile viewports. */
import { expect, test } from "@playwright/test";
import { assertNoHudOverlap, attachRuntimeGuards, captureQaScreenshot, enterOverworld, measureFps } from "./helpers/gameHarness.js";

test("baseline overworld gameplay, map FPS cliff, inventory & visual check", async ({ page }, testInfo) => {
  const guards = attachRuntimeGuards(page);
  const project = testInfo.project.name;

  await enterOverworld(page, `Smoke_${project}`);

  if (project === "mobile") {
    await page.touchscreen.tap(110, 520);
  } else {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(350);
    await page.keyboard.up("KeyD");
  }

  const isSoftwareCi = Boolean(process.env.CI || process.env.PW_SWIFTSHADER === "1");
  const minBaseFps = isSoftwareCi ? 1 : 12;
  const minMapRatio = isSoftwareCi ? 0.45 : 0.55;

  const baseFps = await measureFps(page, 1_400);
  expect(baseFps.medianFps, `${project} baseline FPS too low: ${baseFps.medianFps}`).toBeGreaterThanOrEqual(minBaseFps);
  await assertNoHudOverlap(page);
  await captureQaScreenshot(page, { phase: "baseline", project, reqId: "gameplay", medianFps: baseFps.medianFps });

  await page.locator(".ow-map-btn").click();
  const minimap = page.locator(".ow-minimap");
  await expect(minimap).toBeVisible();
  const mapFps = await measureFps(page, 1_200);
  expect(mapFps.medianFps, `Map FPS cliff detected (${baseFps.medianFps} -> ${mapFps.medianFps})`).toBeGreaterThanOrEqual(baseFps.medianFps * minMapRatio);
  await captureQaScreenshot(page, { phase: "baseline", project, reqId: "map", medianFps: mapFps.medianFps });
  await page.locator(".ow-map-btn").click();
  await expect(minimap).toBeHidden();

  const invBtn = page.locator("button[aria-label='Inventory'], button[aria-label='Bag'], button:has-text('Bag')").first();
  if (await invBtn.isVisible()) {
    await invBtn.click();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(".ow-inv-modal")).toBeVisible();
  await captureQaScreenshot(page, { phase: "baseline", project, reqId: "inventory" });

  guards.assertClean();
});
