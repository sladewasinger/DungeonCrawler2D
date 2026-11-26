/** Shared Playwright E2E helpers for Phase 9 Fog-of-War, Sanctuary Hubs, Economy, Blacksmith, and Stash gates. */
import { expect, type Page } from "@playwright/test";
import { teleportPlayer } from "./phase8Helpers.js";

interface AdminWindow {
  admin?: {
    giveGold?(amount?: number): void;
  };
}

export const HUB_SPOTS = {
  guide: { x: -1.5, y: -2.1, modal: ".ow-guide-modal" },
  merchant: { x: 3.1, y: 3.5, modal: ".ow-merchant-modal" },
  blacksmith: { x: 3.1, y: -3.5, modal: ".ow-blacksmith-modal" },
  bounty: { x: -1.5, y: 1.3, modal: ".ow-bounty-modal" },
  stash: { x: 1.5, y: 3.1, modal: ".ow-stash-modal" },
} as const;

export async function giveGold(page: Page, amount: number): Promise<void> {
  await page.evaluate((amt) => {
    (window as unknown as AdminWindow).admin?.giveGold?.(amt);
  }, amount);
}

export async function openHubStationAt(page: Page, opts: {
  readonly x: number;
  readonly y: number;
  readonly project: string;
  readonly modalSelector: string;
}): Promise<void> {
  await teleportPlayer(page, { x: opts.x, y: opts.y });
  const prompt = page.locator(".ow-chest-prompt");
  await expect(prompt).toBeVisible({ timeout: 6_000 });
  if (opts.project === "mobile") await prompt.click();
  else await page.keyboard.press("KeyE");
  await expect(page.locator(opts.modalSelector)).toBeVisible({ timeout: 5_000 });
}

export async function closeHubModal(page: Page, modalSelector: string): Promise<void> {
  await page.locator(`${modalSelector} button:has-text('Close')`).click();
  await expect(page.locator(modalSelector)).toBeHidden({ timeout: 4_000 });
}

export async function assertModalFitsViewport(page: Page, modalSelector: string): Promise<void> {
  const modal = page.locator(modalSelector);
  const box = await modal.boundingBox();
  const vp = page.viewportSize();
  expect(box && vp, `Missing bounding box for ${modalSelector}`).toBeTruthy();
  if (!box || !vp) return;
  expect(box.x).toBeGreaterThanOrEqual(-2);
  expect(box.y).toBeGreaterThanOrEqual(-2);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 2);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);
}

export async function reloadAndReenterWorld(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  const backdrop = page.locator(".ow-title-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 15_000 });
  await page.locator(".ow-title-enter").click();
  await expect(backdrop).toBeHidden({ timeout: 15_000 });
  await expect(page.locator("#app canvas").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(300);
}

export async function sampleMinimapFogContrast(page: Page): Promise<{
  readonly centerLum: number;
  readonly cornerLum: number;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector(".ow-minimap canvas") as HTMLCanvasElement | null;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!canvas || !ctx) return { centerLum: 0, cornerLum: 0 };
    const mid = Math.floor(canvas.width / 2);
    const luma = (x: number, y: number): number => {
      const p = ctx.getImageData(x, y, 1, 1).data;
      return Math.round(((p[0] || 0) + (p[1] || 0) + (p[2] || 0)) / 3);
    };
    return { centerLum: luma(mid, mid), cornerLum: luma(6, 6) };
  });
}
