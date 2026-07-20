import { expect, test, type Page } from "@playwright/test";
import { COMBAT_ARENA } from "./env.js";
import { nearestEntity, openGame, readState } from "./helpers.js";

/** Counts live, non-expired blood decals on the dungeon scene's display list — decals are
 * pooled Ellipse Shapes, MULTIPLY-blended (vfx/bloodDecalPool.ts); a hidden/expired one
 * stays in the pool but flips `visible` off, so filtering on that is what "still showing"
 * means, not just "was ever spawned". */
async function bloodDecalCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const game = window.__dc2d!.game as unknown as {
      scene: { getScene(key: string): { children: { list: Array<Record<string, unknown>> } } };
    };
    const children = game.scene.getScene("dungeon").children.list;
    return children.filter((c) => c["type"] === "Ellipse" && c["visible"] === true).length;
  });
}

test.describe("combat", () => {
  test("attacking the slime-pit fixtures hurts them and splatters a blood decal", async ({ page }) => {
    await openGame(page, "Fighter");
    // Debug teleport beside the arena fixture, per ENGINEERING_STANDARDS.md's own
    // testing rule ("visuals via Playwright... using debug teleport, never by
    // wandering") — the world now has solid-wall collision, so a blind axis-walk
    // from spawn risks getting stuck on geometry this suite doesn't need to path around.
    await page.evaluate(
      ({ x, y }) => window.__dc2d!.conn.debugTeleport(x + 1, y),
      COMBAT_ARENA,
    );
    await page.waitForFunction(
      ({ x, y }) => {
        const body = window.__dc2d!.conn.body!;
        return Math.hypot(body.x - (x + 1), body.y - y) < 1;
      },
      COMBAT_ARENA,
      { timeout: 5_000 },
    );

    const target = await nearestEntity(page, "enemy", "slime");
    expect(target, "a slime fixture is present in the test zone").not.toBeNull();

    // Swing whenever the slime is in reach, same real-attack loop the live game's
    // click-to-swing path drives — conn.attack() is the same intent a real melee click
    // sends (input/pointer.ts's triggerAttack), just invoked directly for a tight loop.
    // Resolves once the server removes the killed fixture from AOI.
    await page.waitForFunction(
      (id) => {
        const conn = window.__dc2d!.conn;
        const body = conn.body!;
        const enemy = conn.entities.get(id!);
        if (!enemy) return true; // dead and gone from AOI
        const dx = enemy.snap["x"] as number;
        const dy = enemy.snap["y"] as number;
        const ddx = dx - body.x;
        const ddy = dy - body.y;
        if (Math.hypot(ddx, ddy) < 2) conn.attack(ddx, ddy);
        return false;
      },
      target?.id,
      { timeout: 15_000, polling: 200 },
    );

    const decals = await bloodDecalCount(page);
    expect(decals).toBeGreaterThan(0);
  });

  test("suicide kills the player, who respawns alive a couple seconds later", async ({ page }) => {
    await openGame(page, "Respawner");
    const before = await readState(page);
    expect(before.hp).toBeGreaterThan(0);

    await page.evaluate(() => window.__dc2d!.conn.suicide());
    await page.waitForFunction(() => window.__dc2d!.conn.hp <= 0, undefined, { timeout: 3_000 });

    await page.waitForFunction(() => window.__dc2d!.conn.hp > 0, undefined, { timeout: 6_000 });
    const after = await readState(page);
    expect(after.hp).toBeGreaterThan(0);
    // Same session/identity — a respawn, not a fresh reconnect.
    expect(after.playerId).toBe(before.playerId);
  });
});
