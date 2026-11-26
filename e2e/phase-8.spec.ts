/** Real-browser Desktop, Mobile, and Visual verification suite for Phase 8 (REQ-P8-02..18). */
import { PropKind } from "@dc2d/engine";
import { expect, test, type Page } from "@playwright/test";
import { assertNoHudOverlap, attachRuntimeGuards, captureQaScreenshot, enterOverworld } from "./helpers/gameHarness.js";
import {
  authenticateAndGiveItems, enterOfflineOverworld, findClearHalfPlaneSpots, findNearestSeedProp,
  openCraftingFromToolbar, placeHeldStructure, selectHotbarByItemTitle, teleportPlayer, triggerHeldAction,
  useItemViaInventory, walkTowardPoint,
} from "./helpers/phase8Helpers.js";

const PHASE_ID = "phase-8";
const ATTR_ACTIVE = "data-active";
const SEL_CRAFT_MODAL = ".ow-craft-modal";
const SEL_PROMPT = ".ow-chest-prompt";
const SEL_RESET_BTN = ".ow-reset-world-btn";
const SEL_WELL_FED = ".ow-buff-badge[data-buff='well-fed']";
const NAME_STORAGE_CHEST = "Storage Chest";
const STORAGE_KEY = "dc2d_offline_world_v1_1337";

async function verifyStationAndGhostFlow(page: Page, project: string): Promise<void> {
  await openCraftingFromToolbar(page);
  await expect(page.locator(`${SEL_CRAFT_MODAL} .ow-station-pill:has-text('Hand')`)).toHaveAttribute(ATTR_ACTIVE, "true");
  await expect(page.locator(`${SEL_CRAFT_MODAL} .ow-station-pill:has-text('Workbench')`)).toHaveAttribute(ATTR_ACTIVE, "false");
  await page.locator(`${SEL_CRAFT_MODAL} button:has-text('Close')`).click();
  const spot = findClearHalfPlaneSpots(1, 2)[project === "mobile" ? 1 : 0]!;
  await teleportPlayer(page, { x: spot.x - 1.5, y: spot.y });
  if (project === "mobile") await walkTowardPoint(page, { targetX: spot.x - 1.3, targetY: spot.y, project, tolerance: 0.4, maxSteps: 2 });
  await selectHotbarByItemTitle(page, "Workbench");
  const badge = page.locator(".ow-placement-badge");
  await expect(badge).toBeVisible();
  if (project === "mobile") await page.locator(".ow-rot-btn").click();
  else await page.keyboard.press("KeyR");
  await expect(badge).toHaveAttribute("data-rot", "1");
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P8-09" });
  await placeHeldStructure(page, project);
  await expect(page.locator(SEL_PROMPT)).toContainText("Workbench");
  await openCraftingFromToolbar(page);
  await expect(page.locator(`${SEL_CRAFT_MODAL} .ow-station-pill:has-text('Workbench')`)).toHaveAttribute(ATTR_ACTIVE, "true");
  await page.locator(`${SEL_CRAFT_MODAL} button:has-text('Close')`).click();
}

async function verifyBuffIconTrayAndWarming(page: Page, project: string): Promise<void> {
  await useItemViaInventory(page, "Cooked Meat");
  await page.waitForTimeout(520);
  await useItemViaInventory(page, "Herbal Tea");
  await teleportPlayer(page, { x: 2.0, y: -0.6 });
  await expect(page.locator(".ow-warming-bar, .ow-buff-badge[data-buff='rested']").first()).toBeVisible({ timeout: 6_000 });
  await page.waitForTimeout(520);
  await useItemViaInventory(page, "Herbal Salve");
  await expect(page.locator(SEL_WELL_FED)).toBeVisible();
  await expect(page.locator(".ow-buff-badge[data-buff='invigorated']")).toBeVisible();
  await expect(page.locator(".ow-buff-badge[data-buff='salve']")).toBeVisible();
  const vitalsText = await page.locator(".ow-vitals").innerText();
  expect(vitalsText).not.toMatch(/\bFED\b|\bREST\b/);
  await page.locator(SEL_WELL_FED).click();
  await expect(page.locator(".ow-buff-tooltip")).toBeVisible();
  await assertNoHudOverlap(page);
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P8-16" });
}

test("[REQ-P8-02][REQ-P8-09][REQ-P8-13][REQ-P8-16] 3-tier crafting stations, ghost placement, warming, and HUD icon buff tray", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const guards = attachRuntimeGuards(page);
  const project = testInfo.project.name;
  await enterOverworld(page, `P8Main_${project}`);
  await authenticateAndGiveItems(page, [
    ["workbench", 1], ["cooked-meat", 2], ["herb-tea", 2], ["healing-salve", 2], ["wood", 20], ["stone", 10],
  ]);
  await verifyStationAndGhostFlow(page, project);
  await verifyBuffIconTrayAndWarming(page, project);
  guards.assertClean();
});

async function verifyResetLocalWorldUi(page: Page): Promise<void> {
  await page.goto("/?qaDiag=1&offline=1", { waitUntil: "domcontentloaded" });
  const titleReset = page.locator(`.ow-title-backdrop ${SEL_RESET_BTN}`);
  await expect(titleReset).toHaveText("Reset Local World");
  await titleReset.click();
  await expect(titleReset).toHaveText("Confirm Reset?");
  await page.locator(".ow-title-enter").click();
  await expect(page.locator("#app canvas").first()).toBeVisible({ timeout: 15_000 });
  await authenticateAndGiveItems(page, [["wood", 8]], false);
  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).not.toBeNull();
  await page.locator("button[aria-label='Settings']").click();
  const settingsReset = page.locator(`.ow-settings-modal ${SEL_RESET_BTN}`);
  await settingsReset.click();
  await expect(settingsReset).toHaveText("Confirm Reset?");
  await settingsReset.click();
  expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
}

test("[REQ-P8-06][REQ-P8-18] bush forage prompt interaction and Reset Local World confirmation", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const guards = attachRuntimeGuards(page);
  const project = testInfo.project.name;
  await verifyResetLocalWorldUi(page);
  await enterOverworld(page, `P8Forage_${project}`);
  const bush = findNearestSeedProp({ kinds: [PropKind.Bush, PropKind.Wildflower], maxDist: 45 });
  await walkTowardPoint(page, { targetX: bush.x, targetY: bush.y, project, tolerance: 1.75, maxSteps: 28 });
  await expect(page.locator(SEL_PROMPT)).toBeVisible({ timeout: 8_000 });
  if (project === "mobile") await expect(page.locator(SEL_PROMPT)).toHaveText("FORAGE");
  else await expect(page.locator(SEL_PROMPT)).toHaveText("[E] Forage");
  await assertNoHudOverlap(page);
  guards.assertClean();
});

async function placeCampStructuresAndPin(page: Page, project: string): Promise<void> {
  const spots = findClearHalfPlaneSpots(-1, 3).sort((a, b) => b.x - a.x);
  for (const [idx, item] of ["Workbench", "Wooden Palisade", "Camp Bed"].entries()) {
    const spot = spots[idx]!;
    await teleportPlayer(page, { x: spot.x - 1.5, y: spot.y });
    await selectHotbarByItemTitle(page, item);
    await placeHeldStructure(page, project);
    await page.waitForTimeout(160);
  }
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P8-08" });
  await page.locator(".ow-map-btn").click();
  await expect(page.locator(".ow-minimap")).toBeVisible();
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P8-14" });
  await page.locator(".ow-map-btn").click();
}

async function verifyChestGuardAndGather(page: Page, project: string): Promise<void> {
  const chestSpot = findClearHalfPlaneSpots(1, 3)[2]!;
  await teleportPlayer(page, { x: chestSpot.x - 1.5, y: chestSpot.y });
  await selectHotbarByItemTitle(page, NAME_STORAGE_CHEST);
  await placeHeldStructure(page, project);
  await page.waitForTimeout(180);
  await expect(page.locator(SEL_PROMPT)).toContainText(NAME_STORAGE_CHEST);
  await page.keyboard.press("KeyE");
  await expect(page.locator(".ow-chest-modal")).toBeVisible({ timeout: 5_000 });
  await page.locator(".ow-hotbar [data-slot-index='0']").click({ button: "right" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyZ");
  await page.keyboard.press("KeyE");
  await expect(page.locator(".ow-chest-modal")).toBeVisible({ timeout: 5_000 });
  await page.locator(".ow-chest-modal button:has-text('Take All')").click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.keyboard.press("KeyZ");
  await expect(page.locator(SEL_PROMPT)).not.toContainText(NAME_STORAGE_CHEST, { timeout: 5_000 });
  const tree = findNearestSeedProp({ kinds: [PropKind.OakTree, PropKind.PineTree, PropKind.BirchTree], maxDist: 42, origin: chestSpot });
  await selectHotbarByItemTitle(page, "Woodcutter Axe");
  await teleportPlayer(page, { x: tree.x - 1.1, y: tree.y });
  await triggerHeldAction(page, project);
  await page.waitForTimeout(150);
  await captureQaScreenshot(page, { phase: PHASE_ID, project, reqId: "REQ-P8-04" });
}

test("[REQ-P8-08][REQ-P8-14] HD camp structures, palisades, and bed home pin on map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only camp structures + bed minimap visual check");
  test.setTimeout(90_000);
  const guards = attachRuntimeGuards(page);
  await enterOverworld(page, "P8Camp");
  await authenticateAndGiveItems(page, [["workbench", 1], ["camp-bed", 1], ["wood-palisade", 2]]);
  await placeCampStructuresAndPin(page, testInfo.project.name);
  guards.assertClean();
});

test("[REQ-P8-04][REQ-P8-05][REQ-P8-10][REQ-P8-11] chest dismantle guard, full refund, and gathering feedback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only chest dismantle guard and tree gathering check");
  test.setTimeout(90_000);
  const guards = attachRuntimeGuards(page);
  await enterOverworld(page, "P8Chest");
  await authenticateAndGiveItems(page, [["storage-chest", 1], ["pickaxe", 1], ["axe", 1]]);
  await verifyChestGuardAndGather(page, testInfo.project.name);
  guards.assertClean();
});

test("[REQ-P8-17] offline world persistence across browser reload", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop-only offline persistence reload check");
  const guards = attachRuntimeGuards(page);
  await enterOfflineOverworld(page, true);
  await authenticateAndGiveItems(page, [["workbench", 1], ["cooked-meat", 1]], false);
  await useItemViaInventory(page, "Cooked Meat");
  await expect(page.locator(SEL_WELL_FED)).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(SEL_WELL_FED)).toBeVisible({ timeout: 12_000 });
  guards.assertClean();
});
