/** Real-browser Desktop, Mobile, and Visual verification suite for Phase 9 (REQ-P9-02..14, REQ-P9-16). */
import { expect, test, type Page } from "@playwright/test";
import { assertNoHudOverlap, attachRuntimeGuards, captureQaScreenshot, enterOverworld, measureFps } from "./helpers/gameHarness.js";
import { authenticateAndGiveItems, enterOfflineOverworld, teleportPlayer } from "./helpers/phase8Helpers.js";
import {
  HUB_SPOTS, assertModalFitsViewport, closeHubModal, giveGold, openHubStationAt,
  reloadAndReenterWorld, sampleMinimapFogContrast,
} from "./helpers/phase9Helpers.js";

const PHASE_ID = "phase-9";
const SEL_GOLD_HUD = ".ow-vitals .ow-gold-badge";
const SEL_MAP_BTN = ".ow-map-btn";
const SEL_MINIMAP = ".ow-minimap";
const SEL_NOTICE = ".ow-hub-notice";
const SEL_BOUNTY_HUD = ".ow-bounty-hud";
const SEL_STORAGE_KEY = "dc2d_offline_world_v1_1337";

async function verifyMapFogAndFps(page: Page, project: string): Promise<void> {
  const isSoftwareCi = Boolean(process.env.CI || process.env.PW_SWIFTSHADER === "1");
  const minFps = isSoftwareCi ? 1 : 45;
  const baseFps = await measureFps(page, 1_100);
  expect(baseFps.medianFps, `${project} baseline FPS`).toBeGreaterThanOrEqual(isSoftwareCi ? 1 : 12);

  await page.locator(SEL_MAP_BTN).click();
  await expect(page.locator(SEL_MINIMAP)).toBeVisible();
  const mapFps = await measureFps(page, 1_100);
  if (!isSoftwareCi && baseFps.medianFps >= 45) {
    expect(mapFps.medianFps, `Map FPS below 45 (${mapFps.medianFps})`).toBeGreaterThanOrEqual(minFps);
  }
  expect(mapFps.medianFps).toBeGreaterThanOrEqual(baseFps.medianFps * (isSoftwareCi ? 0.45 : 0.6));

  const contrast = await sampleMinimapFogContrast(page);
  expect(contrast.centerLum).toBeGreaterThan(contrast.cornerLum);
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P9-02", medianFps: mapFps.medianFps });
  await page.locator(SEL_MAP_BTN).click();
  await expect(page.locator(SEL_MINIMAP)).toBeHidden();
}

async function verifyMerchantFlow(page: Page, project: string): Promise<void> {
  await openHubStationAt(page, { ...HUB_SPOTS.merchant, project, modalSelector: HUB_SPOTS.merchant.modal });
  await page.locator(`${HUB_SPOTS.merchant.modal} button[data-offer-id='offer-copper-pick']`).click();
  await expect(page.locator(`${HUB_SPOTS.merchant.modal} ${SEL_NOTICE}`)).toContainText("Not enough Gold");

  await giveGold(page, 600);
  await expect(page.locator(SEL_GOLD_HUD)).toHaveText("600g", { timeout: 5_000 });
  await page.locator(`${HUB_SPOTS.merchant.modal} button[data-offer-id='offer-arrows']`).click();
  await expect(page.locator(SEL_GOLD_HUD)).toHaveText("576g", { timeout: 5_000 });

  await page.locator(`${HUB_SPOTS.merchant.modal} .ow-hub-tab:has-text('Sell Bag')`).click();
  const sellBtn = page.locator(`${HUB_SPOTS.merchant.modal} button[data-sell-slot]`).last();
  await expect(sellBtn).toBeVisible();
  await sellBtn.click();
  await expect(page.locator(SEL_GOLD_HUD)).not.toHaveText("576g", { timeout: 5_000 });
  await closeHubModal(page, HUB_SPOTS.merchant.modal);
}

async function verifyBlacksmithAndItemCard(page: Page, project: string): Promise<void> {
  await openHubStationAt(page, { ...HUB_SPOTS.blacksmith, project, modalSelector: HUB_SPOTS.blacksmith.modal });
  const modal = HUB_SPOTS.blacksmith.modal;
  const reforgeBtn = page.locator(`${modal} button[data-reforge-slot]`).first();
  const upgradeBtn = page.locator(`${modal} button[data-upgrade-slot]`).first();
  await expect(reforgeBtn).toBeVisible();
  await reforgeBtn.click();
  await expect(page.locator(`${modal} ${SEL_NOTICE}`)).toContainText("Reforged");

  for (const nextLv of [1, 2, 3]) {
    await expect(upgradeBtn).toContainText(`Upgrade +${nextLv}`);
    await upgradeBtn.click();
    await expect(page.locator(`${modal} .ow-hub-title`).first()).toContainText(`+${nextLv}`);
  }
  await expect(upgradeBtn).toContainText("Max +3");
  await upgradeBtn.click();
  await expect(page.locator(`${modal} ${SEL_NOTICE}`)).toContainText("Maximum upgrade level (+3) reached");
  if (project === "desktop") await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P9-11" });
  await closeHubModal(page, modal);

  const swordUpgradeBadge = page.locator(".ow-hotbar [data-slot-index='0'] .ow-slot-upgrade");
  await expect(swordUpgradeBadge).toHaveText("+3");
  if (project === "desktop") {
    await page.locator(".ow-hotbar [data-slot-index='0']").hover();
    await expect(page.locator(".ow-item-card")).toBeVisible({ timeout: 4_000 });
    await expect(page.locator(".ow-item-card .ow-ic-name")).toContainText("+3");
  }
}

test("[REQ-P9-02][REQ-P9-03][REQ-P9-04][REQ-P9-14] fog-of-war map, Sanctuary Hub safety, prompts, and viewport fit", async ({ page }, testInfo) => {
  test.setTimeout(110_000);
  const guards = attachRuntimeGuards(page);
  const project = testInfo.project.name;
  await enterOverworld(page, `P9Map_${project}`);
  await authenticateAndGiveItems(page, []);

  await expect(page.locator(".ow-sanctuary-pill")).toBeVisible();
  await verifyMapFogAndFps(page, project);

  await teleportPlayer(page, { x: 46, y: 0 });
  if (project === "desktop") {
    await reloadAndReenterWorld(page);
    await page.locator(SEL_MAP_BTN).click();
    await expect(page.locator(SEL_MINIMAP)).toBeVisible();
    await page.locator(SEL_MAP_BTN).click();
    await authenticateAndGiveItems(page, []);
  }

  await openHubStationAt(page, { ...HUB_SPOTS.guide, project, modalSelector: HUB_SPOTS.guide.modal });
  await assertModalFitsViewport(page, HUB_SPOTS.guide.modal);
  await assertNoHudOverlap(page);
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P9-14" });
  await closeHubModal(page, HUB_SPOTS.guide.modal);
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P9-04" });
  guards.assertClean();
});

test("[REQ-P9-06][REQ-P9-07][REQ-P9-08][REQ-P9-09][REQ-P9-10][REQ-P9-11][REQ-P9-12][REQ-P9-13] Gold, Merchant, Blacksmith +3, Bounties, Guide, and Stash", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const guards = attachRuntimeGuards(page);
  const project = testInfo.project.name;
  await enterOverworld(page, `P9Hub_${project}`);
  await authenticateAndGiveItems(page, [
    ["flint", 4], ["copper-ingot", 4], ["iron-ingot", 4], ["sunstone", 4],
    ["wood", 4], ["stone", 4], ["herb", 4], ["bandage", 4], ["cooked-meat", 4], ["raw-meat", 4],
  ]);

  await expect(page.locator(SEL_GOLD_HUD)).toHaveText("0g");
  await verifyMerchantFlow(page, project);

  await openHubStationAt(page, { ...HUB_SPOTS.bounty, project, modalSelector: HUB_SPOTS.bounty.modal });
  await expect(page.locator(`${HUB_SPOTS.bounty.modal} .ow-hub-row`)).toHaveCount(3);
  await page.locator(`${HUB_SPOTS.bounty.modal} button[data-accept-bounty]`).first().click();
  await expect(page.locator(SEL_BOUNTY_HUD)).toBeVisible({ timeout: 4_000 });
  await closeHubModal(page, HUB_SPOTS.bounty.modal);

  await openHubStationAt(page, { ...HUB_SPOTS.guide, project, modalSelector: HUB_SPOTS.guide.modal });
  const questRows = await page.locator(`${HUB_SPOTS.guide.modal} .ow-hub-row`).count();
  expect(questRows).toBeGreaterThanOrEqual(4);
  await page.locator(`${HUB_SPOTS.guide.modal} button[data-accept-quest]`).first().click();
  await closeHubModal(page, HUB_SPOTS.guide.modal);

  await verifyBlacksmithAndItemCard(page, project);

  await openHubStationAt(page, { ...HUB_SPOTS.stash, project, modalSelector: HUB_SPOTS.stash.modal });
  const bagItem = page.locator(`${HUB_SPOTS.stash.modal} button[aria-label^='Backpack slot']:has(img)`).first();
  await expect(bagItem).toBeVisible();
  await bagItem.click();
  const stashSlot = page.locator(`${HUB_SPOTS.stash.modal} button[aria-label='Stash slot 1']:has(img)`);
  await expect(stashSlot).toBeVisible({ timeout: 4_000 });
  await closeHubModal(page, HUB_SPOTS.stash.modal);

  if (project === "desktop") {
    await reloadAndReenterWorld(page);
    await expect(page.locator(SEL_GOLD_HUD)).not.toHaveText("0g", { timeout: 6_000 });
    await expect(page.locator(SEL_BOUNTY_HUD)).toBeVisible({ timeout: 6_000 });
    await authenticateAndGiveItems(page, []);
    await openHubStationAt(page, { ...HUB_SPOTS.stash, project, modalSelector: HUB_SPOTS.stash.modal });
    await expect(stashSlot).toBeVisible({ timeout: 5_000 });
    await closeHubModal(page, HUB_SPOTS.stash.modal);
  }
  guards.assertClean();
});

test("[REQ-P9-16] offline preview Gold, Stash, and Fog persistence across F5 reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only offline Phase 9 reload parity check");
  test.setTimeout(90_000);
  const guards = attachRuntimeGuards(page);
  await enterOfflineOverworld(page, true);
  await giveGold(page, 180);
  await expect(page.locator(SEL_GOLD_HUD)).toHaveText("180g");

  await authenticateAndGiveItems(page, [
    ["wood", 4], ["stone", 4], ["flint", 4], ["copper-ore", 4], ["iron-ore", 4],
    ["herb", 4], ["bandage", 4], ["cooked-meat", 4], ["berry", 4], ["raw-meat", 4],
  ], false);
  await openHubStationAt(page, { ...HUB_SPOTS.stash, project: "desktop", modalSelector: HUB_SPOTS.stash.modal });
  await page.locator(`${HUB_SPOTS.stash.modal} button[aria-label^='Backpack slot']:has(img)`).first().click();
  await expect(page.locator(`${HUB_SPOTS.stash.modal} button[aria-label='Stash slot 1']:has(img)`)).toBeVisible();
  await closeHubModal(page, HUB_SPOTS.stash.modal);

  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  const rawSaved = await page.evaluate((k) => localStorage.getItem(k), SEL_STORAGE_KEY);
  expect(rawSaved).toContain("\"gold\":180");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#app canvas").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(SEL_GOLD_HUD)).toHaveText("180g", { timeout: 8_000 });
  await openHubStationAt(page, { ...HUB_SPOTS.stash, project: "desktop", modalSelector: HUB_SPOTS.stash.modal });
  await expect(page.locator(`${HUB_SPOTS.stash.modal} button[aria-label='Stash slot 1']:has(img)`)).toBeVisible();
  guards.assertClean();
});
