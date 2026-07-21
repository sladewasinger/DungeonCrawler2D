import { expect, test } from "@playwright/test";
import { CLIENT_URL } from "./env.js";

/**
 * LANE W3 gate (the user's own "north locked" litmus test): the editor's render panel
 * rotates through the exact same seam the game uses, and click-painting through it
 * remaps pointer -> viewToWorld -> the correct WORLD cell at every orientation. Every
 * action here is a REAL trusted keyboard/mouse event (Phaser ignores synthetic
 * dispatchEvent calls, same convention as the rest of this suite) — this spec never
 * uses page.evaluate to fake input, only to read back state.
 *
 * Reads the debug globals via a local `as unknown as EditorDebugWindow` cast (main.ts's
 * own convention for these hooks) rather than a `declare global` block:
 * editorBench.test.ts already declares a narrower shape for `window.__editorStore` (no
 * `.world`) — a second, wider `declare global` for the same property would conflict
 * rather than merge.
 */

interface EditorDebugWindow {
  __editorStore: {
    brush: { kind: string };
    world: { stackAt(x: number, y: number): { walls: number } };
  };
  __game: { scene: { getScene(key: string): EditorPhaserScene } };
  __editorViewOrientation: () => number;
}

interface EditorPhaserScene {
  cameras: { main: { getWorldPoint(x: number, y: number): { x: number; y: number } } };
  game: { canvas: HTMLCanvasElement };
}

// worldToView at orientation 270 (viewTransform.ts): point(-world.y, world.x) — exact
// inverse of viewToWorld's point(view.y, -view.x). Duplicated here (not imported) since
// e2e specs drive the real page only, never import the app's own modules; cross-checked
// against packages/client/src/render/view/viewTransform.test.ts's exhaustive unit coverage.
function worldToView270(wx: number, wy: number): { x: number; y: number } {
  return { x: -wy, y: wx };
}

const SCREEN_TILE_PX = 48;
const TARGET_WX = 3;
const TARGET_WY = 12;

test.describe("editor rotation", () => {
  test("[ / ] rotate the render panel; a real click at orientation 270 paints the intended world cell, and only that cell", async ({ page }) => {
    test.setTimeout(30_000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${CLIENT_URL}/?scene=editor&debug=1`);
    await page.waitForFunction(() => {
      const w = window as unknown as Partial<EditorDebugWindow>;
      return w.__editorStore !== undefined && w.__game !== undefined && w.__editorViewOrientation !== undefined;
    });
    expect(await page.evaluate(() => (window as unknown as EditorDebugWindow).__editorViewOrientation())).toBe(0);

    const before = await page.screenshot();
    await page.locator("body").click({ position: { x: 10, y: 10 } }); // focus the page, not any input
    await page.keyboard.press("]");
    await page.waitForFunction(
      () => (window as unknown as EditorDebugWindow).__editorViewOrientation() === 90,
      undefined,
      { timeout: 2_000 },
    );
    const after90 = await page.screenshot();
    expect(after90.equals(before), "a real terrain pixel actually moved after rotating").toBe(false);

    await page.keyboard.press("[");
    await page.waitForFunction(
      () => (window as unknown as EditorDebugWindow).__editorViewOrientation() === 0,
      undefined,
      { timeout: 2_000 },
    );
    // One more "[" step: 0 -> 270 (ccw), matching rotateOrientation's dir=-1 convention.
    await page.keyboard.press("[");
    await page.waitForFunction(
      () => (window as unknown as EditorDebugWindow).__editorViewOrientation() === 270,
      undefined,
      { timeout: 2_000 },
    );

    await page.evaluate(() => {
      (window as unknown as EditorDebugWindow).__editorStore.brush = { kind: "wall" };
    });

    const view = worldToView270(TARGET_WX, TARGET_WY);
    const { screenX, screenY } = await page.evaluate(
      ({ viewX, viewY, tilePx }) => {
        const scene = (window as unknown as EditorDebugWindow).__game.scene.getScene("editor");
        const cam = scene.cameras.main;
        const worldPxX = viewX * tilePx + tilePx / 2;
        const worldPxY = viewY * tilePx + tilePx / 2;
        // Calibrate the canvas-local screen->world mapping empirically via the camera's
        // OWN getWorldPoint (exactly what Phaser derives pointer.worldX/Y from) at two
        // sample screen points per axis, rather than hand-deriving the zoom/scroll/
        // origin composition (Camera.preRender's ITRS matrix) — the affine map is exact
        // since the camera is never rotated, only panned/zoomed.
        const p0 = cam.getWorldPoint(0, 0);
        const p1 = cam.getWorldPoint(100, 100);
        const canvasX = (worldPxX - p0.x) / ((p1.x - p0.x) / 100);
        const canvasY = (worldPxY - p0.y) / ((p1.y - p0.y) / 100);
        const rect = scene.game.canvas.getBoundingClientRect();
        return { screenX: rect.left + canvasX, screenY: rect.top + canvasY };
      },
      { viewX: view.x, viewY: view.y, tilePx: SCREEN_TILE_PX },
    );

    await page.mouse.click(screenX, screenY);

    const painted = await page.evaluate(
      ({ wx, wy }) => (window as unknown as EditorDebugWindow).__editorStore.world.stackAt(wx, wy),
      { wx: TARGET_WX, wy: TARGET_WY },
    );
    expect(painted.walls, `expected the wall brush to land on world cell (${TARGET_WX},${TARGET_WY})`).toBe(1);

    // A neighbor stays untouched — proof this wasn't a lucky whole-grid paint.
    const neighbor = await page.evaluate(
      ({ wx, wy }) => (window as unknown as EditorDebugWindow).__editorStore.world.stackAt(wx, wy),
      { wx: TARGET_WX + 1, wy: TARGET_WY },
    );
    expect(neighbor.walls).toBe(0);

    expect(errors, `no console errors across the rotation + click-paint round-trip, got: ${errors.join(" | ")}`).toEqual([]);
  });
});
