import { expect, test, type Page } from "@playwright/test";
import { openGame, readState } from "./helpers.js";
import { brightnessField, e2eWorld } from "./lightField.js";
import { LIGHT_APRON } from "../../packages/client/src/render/terrain/tileLight.js";

/**
 * Throws a starter-kit torch through the REAL click-to-throw path (input/pointer.ts:
 * an equipped throwable always throws on primary attack) and asserts the corridor it
 * lands in actually brightens.
 *
 * DOCUMENTED CHOICE (Epic 7.12 lane brief: "assert via canvas pixel sample or the
 * client's light-state API, your call"): this uses the light-state API, not a pixel
 * sample. The renderer's baked lighting (render/terrain/tileLight.ts's computeLightField)
 * is a PURE function of (world, dynamic light seeds) with no Phaser dependency, so it
 * runs directly in the test process — reconstructing the identical World the live
 * game-server booted (same worldSeed/floor) is guaranteed byte-identical per
 * docs/ENGINEERING_STANDARDS.md's determinism invariant. A pixel sample would need
 * preserveDrawingBuffer on Phaser's WebGL context (a real renderer config change just
 * for testability) and would only prove "some pixel got brighter", not "this specific
 * tile's baked light level rose the way the design intends" — the light-state read is
 * both simpler and a strictly stronger assertion.
 */

async function landedTorchTile(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    for (const remote of window.__dc2d!.conn.entities.values()) {
      const snap = remote.snap;
      if (snap["kind"] === "torch" && snap["state"] === "placed") {
        return { x: Math.floor(snap["x"] as number), y: Math.floor(snap["y"] as number) };
      }
    }
    throw new Error("no placed torch entity found");
  });
}

/**
 * Any walkable tile within the light's full possible reach (LIGHT_APRON tiles — the same
 * radius terrain/lightRebake.ts uses) that reads strictly brighter with the new seed than
 * without it. Compares two whole-window light fields (one BFS flood each) rather than
 * probing tile-by-tile: a fixed nearby candidate (the landing tile, its neighbors, a
 * "search outward for the darkest tile") can land on a spot a wall structurally blocks
 * from ever reaching, or one already maxed by an unrelated authored source — both dead
 * ends this test hit before settling on "scan everything genuinely in range instead of
 * guessing a point". Walls are respected for free: computeLightField's own BFS never
 * lights the far side of one, so an unreachable tile simply never shows an increase.
 */
function findBrightenedTile(world: ReturnType<typeof e2eWorld>, cx: number, cy: number): { x: number; y: number } | null {
  const before = brightnessField(world, cx, cy, LIGHT_APRON, []);
  const after = brightnessField(world, cx, cy, LIGHT_APRON, [{ tileX: cx, tileY: cy, level: 14 }]);
  for (let dy = -LIGHT_APRON; dy <= LIGHT_APRON; dy++) {
    for (let dx = -LIGHT_APRON; dx <= LIGHT_APRON; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!world.isWalkable(x, y)) continue;
      if (after(x, y) > before(x, y)) return { x, y };
    }
  }
  return null;
}

test.describe("throwable torches light the world for real", () => {
  test("throwing a torch south lands it, and its corridor genuinely brightens", async ({ page }) => {
    const before = await openGame(page, "Torchbearer");
    expect(before.inventory.find((s) => s.item === "torch")?.qty).toBe(3);

    // Equip the torch as the weapon — the same "equipped throwable always throws on
    // primary attack" model input/pointer.ts's equippedIsThrowable branch drives.
    await page.evaluate(() => window.__dc2d!.conn.equip("torch"));
    await page.waitForFunction(() => window.__dc2d!.conn.weapon === "torch");

    // A real click, aimed well south of the player — direction is all that matters
    // (net/intents.ts's throwTorch normalizes it), the server clamps to MAX_THROW_RANGE.
    await page.locator("canvas").first().click({ position: { x: 640, y: 700 } });

    await page.waitForFunction(
      () => {
        for (const remote of window.__dc2d!.conn.entities.values()) {
          if (remote.snap["kind"] === "torch" && remote.snap["state"] === "placed") return true;
        }
        return false;
      },
      undefined,
      { timeout: 8_000 },
    );
    // The one-time BFS rebake (torchSync.ts) fires the same tick it lands — settle a
    // couple of frames so the client has definitely applied it before we assert.
    await page.waitForTimeout(150);

    const tile = await landedTorchTile(page);
    const world = e2eWorld();
    const brightened = findBrightenedTile(world, tile.x, tile.y);
    expect(brightened, "some tile within the torch's light radius got measurably brighter").not.toBeNull();

    // Real inventory consequence of the real throw.
    const after = await readState(page);
    expect(after.inventory.find((s) => s.item === "torch")?.qty).toBe(2);
  });
});
