// Clicks a Phaser-rendered (non-DOM) HUD element by its exact visible text, via a REAL
// trusted mouse click at its live screen position — Phaser's InputPlugin ignores a
// synthetic dispatchEvent, so this walks the live display list (the same technique
// reference/e2e's v1 suite used for its own read-side assertions) to find where the
// element actually sits on screen right now, instead of hardcoding layout pixels that
// would drift the moment anchors/offsets change.
import type { Page } from "@playwright/test";

interface ScreenPoint {
  x: number;
  y: number;
}

/** Clicks the "hud" scene's Text object whose text exactly matches `exactText` (e.g. the
 * chat panel's "GLBL" tab label). Throws if nothing matches — a missing HUD element is a
 * real failure, not a silent no-op. */
export async function clickHudText(page: Page, exactText: string): Promise<void> {
  const point = await locateHudText(page, exactText);
  if (!point) throw new Error(`clickHudText: no "${exactText}" text found in the hud scene`);
  await page.mouse.click(point.x, point.y);
}

/** Depth-first search of a Phaser display list for an exact-text Text object — inlined
 * inside locateHudText's page.evaluate callback below (evaluate serializes its closure
 * over the wire, so it can't call out to a real module-level function). */
async function locateHudText(page: Page, exactText: string): Promise<ScreenPoint | null> {
  return page.evaluate((text) => {
    const game = window.__dc2d!.game as unknown as {
      scene: { getScene(key: string): { children: { list: unknown[] } } | null };
      scale: { width: number; height: number };
    };
    const scene = game.scene.getScene("hud");
    if (!scene) return null;
    const find = (list: unknown[]): unknown => {
      for (const obj of list) {
        const o = obj as { type?: string; text?: string; list?: unknown[] };
        if (o.type === "Text" && o.text === text) return o;
        if (o.list) {
          const nested = find(o.list);
          if (nested) return nested;
        }
      }
      return null;
    };
    const found = find(scene.children.list);
    if (!found) return null;
    const bounds = (found as { getBounds(): { centerX: number; centerY: number } }).getBounds();
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / game.scale.width;
    const scaleY = rect.height / game.scale.height;
    return { x: rect.left + bounds.centerX * scaleX, y: rect.top + bounds.centerY * scaleY };
  }, exactText);
}
