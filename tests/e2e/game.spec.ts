import { expect, test } from "@playwright/test";
import { findTile, holdKey, nearestItem, openGame, readState, walkTo } from "./helpers";

// Tile ids mirrored from the engine's TILE map (engine isn't importable here).
const T_DOOR_PERSONAL = 3;
const T_DOOR_EXIT = 5;
const T_DOOR_SAFE_ROOM = 8;

/**
 * Live-browser end-to-end: a real chromium drives the real client
 * against a real game server over real websockets. Movement and jumps
 * use trusted keyboard events — the layer headless tests can't reach.
 */

test.describe("dungeoncrawler2d e2e", () => {
  test("shows both level choices before connecting", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-level="dungeon"]')).toBeVisible();
    await expect(page.locator('[data-level="sandbox"]')).toBeVisible();
  });

  test("boots, connects, and renders the world", async ({ page }) => {
    const state = await openGame(page);
    expect(state.status).toBe("connected");
    expect(state.hp).toBe(30);
    expect(state.playerId).not.toBeNull();
    await expect(page.locator("canvas").first()).toBeVisible();
    // The proving-ground slime fixtures are inside AOI at spawn.
    expect(state.entities.some((e) => e.kind === "enemy" && e.defId === "slime")).toBe(true);
  });

  test("real keyboard movement and a real spacebar jump", async ({ page }) => {
    const before = await openGame(page);

    await holdKey(page, "d", 1000);
    const afterMove = await readState(page);
    expect(afterMove.x).toBeGreaterThan(before.x + 4); // ~8 tiles/s

    // Jump: z must rise above the terrain mid-flight…
    await page.keyboard.down(" ");
    await page.waitForFunction(() => {
      const body = window.__dc2d!.conn.body!;
      return !body.grounded;
    });
    await page.keyboard.up(" ");
    // …and gravity must bring us back down.
    await page.waitForFunction(() => window.__dc2d!.conn.body!.grounded);
  });

  test("two browsers meet: AOI visibility, fistbump party, party chat", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const stateA = await openGame(pageA);
    const stateB = await openGame(pageB);
    expect(stateA.playerId).not.toBe(stateB.playerId);

    // Clustered spawns put them 2 tiles apart: both see each other.
    await pageA.waitForFunction(
      (otherId) => [...window.__dc2d!.conn.entities.keys()].includes(otherId!),
      stateB.playerId,
    );
    await pageB.waitForFunction(
      (otherId) => [...window.__dc2d!.conn.entities.keys()].includes(otherId!),
      stateA.playerId,
    );

    // A invites (F near B), B sees the invite and accepts (F).
    await pageA.keyboard.press("f");
    await pageB.waitForFunction(() => window.__dc2d!.conn.pendingInvite !== null);
    await pageB.keyboard.press("f");
    await pageA.waitForFunction(() => window.__dc2d!.conn.party !== null);
    await pageB.waitForFunction(() => window.__dc2d!.conn.party !== null);
    const partyA = (await readState(pageA)).party!;
    expect(partyA.members.map((m) => m.id)).toContain(stateB.playerId);

    // Party chat through the real chat input, with REAL typed keys.
    // The message deliberately mixes WASD letters, digits, and spaces:
    // Phaser used to capture those at the window level and the input
    // never saw them (and the player walked while you typed). If
    // capture leaks again, the text arrives mangled and this times out.
    const posBefore = await readState(pageA);
    await pageA.keyboard.press("Enter");
    await pageA.keyboard.type("descend at dawn 12 44", { delay: 15 });
    await pageA.keyboard.press("Enter");
    await pageB.waitForFunction(() =>
      window.__dc2d!.conn.chatLog.some(
        (l) => l.text === "descend at dawn 12 44" && l.channel === "party",
      ),
    );
    // Typing W/A/S/D into chat must not move the player.
    const posAfter = await readState(pageA);
    expect(Math.hypot(posAfter.x - posBefore.x, posAfter.y - posBefore.y)).toBeLessThan(0.3);

    await contextA.close();
    await contextB.close();
  });

  test("combat: attacking the slime fixtures hurts and kills them", async ({ page }) => {
    await openGame(page);

    // Walk toward the slimes at (20.5, 42.5): line up on the 3-tile
    // pillar gap (x24–26), then head south through it. Adaptive —
    // clustered spawns shift our start by a few tiles per player.
    for (let i = 0; i < 30; i++) {
      const s = await readState(page);
      if (Math.abs(s.x - 25.2) < 0.6) break;
      await holdKey(page, s.x > 25.2 ? "a" : "d", 200);
    }
    for (let i = 0; i < 30; i++) {
      const s = await readState(page);
      const near = s.entities.some(
        (e) => e.kind === "enemy" && Math.hypot(e.x - s.x, e.y - s.y) < 6,
      );
      if (near || s.y > 44) break;
      await holdKey(page, "s", 300);
    }

    // Wait until a slime is within melee-ish range (they also chase us).
    await page.waitForFunction(() => {
      const conn = window.__dc2d!.conn;
      const body = conn.body!;
      return [...conn.entities.values()].some(
        (e) =>
          e.snap.kind === "enemy" &&
          Math.hypot(e.snap.x - body.x, e.snap.y - body.y) < 1.4,
      );
    }, undefined, { timeout: 20_000 });

    // Mark the nearest slime as our victim (adjacent chunks spawn
    // extra random enemies, so we track one specific id to its death).
    const targetId = await page.evaluate(() => {
      const conn = window.__dc2d!.conn;
      const body = conn.body!;
      let best: string | null = null;
      let dist = Number.POSITIVE_INFINITY;
      for (const e of conn.entities.values()) {
        if (e.snap.kind !== "enemy" || e.snap.defId !== "slime") continue;
        const d = Math.hypot(e.snap.x - body.x, e.snap.y - body.y);
        if (d < dist) {
          dist = d;
          best = e.snap.id;
        }
      }
      return best;
    });
    expect(targetId).not.toBeNull();

    // Swing whenever it's in reach (it chases us; we knock it back)
    // until the server removes the corpse from our AOI.
    await page.waitForFunction(
      (id) => {
        const conn = window.__dc2d!.conn;
        const body = conn.body!;
        const target = conn.entities.get(id!);
        if (!target) return true; // dead and gone
        const dx = target.snap.x - body.x;
        const dy = target.snap.y - body.y;
        if (Math.hypot(dx, dy) < 2) conn.attack(dx, dy);
        return false;
      },
      targetId,
      { timeout: 30_000, polling: 250 },
    );

    // We took some bites in the scrap — hp is authoritative and we live.
    const state = await readState(page);
    expect(state.hp).toBeGreaterThan(0);
    expect(state.hp).toBeLessThanOrEqual(30);
  });

  test("ground items at spawn: pick up the sword — it auto-equips as the weapon", async ({
    page,
  }) => {
    await openGame(page);
    await page.waitForTimeout(600); // let fixtures/areas replicate in
    await page.screenshot({ path: "docs/art-samples/live-proving-ground.png" });
    const sword = await nearestItem(page, "sword");
    expect(sword, "sword fixture visible at spawn").toBeTruthy();
    await walkTo(page, sword!.x, sword!.y);
    await page.keyboard.press("r");
    await page.waitForFunction(() =>
      window.__dc2d!.conn.inventory.some((s) => s.item === "sword"),
    );
    // Weapons go to the character slot, not the hotbar.
    expect(await page.evaluate(() => window.__dc2d!.conn.weapon)).toBe("sword");
    expect(await page.evaluate(() => window.__dc2d!.conn.hotbar.includes("sword"))).toBe(false);
  });

  test("pick up a bandage: hotbar untouched until bound via the panel, then a number key USES it", async ({
    page,
  }) => {
    await openGame(page);
    await page.waitForTimeout(600);
    const bandage = await nearestItem(page, "bandage");
    expect(bandage, "bandage fixture visible at spawn").toBeTruthy();
    await walkTo(page, bandage!.x, bandage!.y);
    await page.keyboard.press("r");
    await page.waitForFunction(() =>
      window.__dc2d!.conn.inventory.some((s) => s.item === "bandage"),
    );
    // Pickups never touch the hotbar — binding is the player's call.
    expect(await page.evaluate(() => window.__dc2d!.conn.hotbar.indexOf("bandage"))).toBe(-1);

    // Bind through the real panel flow: [I] → search → click row → digit.
    await page.keyboard.press("i");
    await expect(page.locator("#inventory-panel")).toBeVisible();
    await page.locator("#inventory-panel input").fill("band");
    await expect(page.locator("#inventory-panel")).toContainText("Bandage");
    await page.getByText(/^Bandage ×/).click();
    await page.keyboard.press("3");
    await page.waitForFunction(() => window.__dc2d!.conn.hotbar[2] === "bandage");
    await page.keyboard.press("Escape");
    await expect(page.locator("#inventory-panel")).toBeHidden();

    const qtyBefore = await page.evaluate(
      () => window.__dc2d!.conn.inventory.find((s) => s.item === "bandage")!.qty,
    );
    await page.keyboard.press("3"); // 1-9 uses the bound item
    await page.waitForFunction(
      (before) =>
        (window.__dc2d!.conn.inventory.find((s) => s.item === "bandage")?.qty ?? 0) < before,
      qtyBefore,
    );
  });

  test("a throwable key arms an aim, then a world click throws it", async ({ page }) => {
    await openGame(page);
    await page.waitForTimeout(600);
    const bottle = await nearestItem(page, "vodka-bottle");
    expect(bottle, "vodka bottle fixture visible at spawn").toBeTruthy();
    await walkTo(page, bottle!.x, bottle!.y);
    await page.keyboard.press("r");
    await page.waitForFunction(() =>
      window.__dc2d!.conn.inventory.some((s) => s.item === "vodka-bottle"),
    );
    await page.keyboard.press("i");
    await page.locator("#inventory-panel input").fill("vodka");
    await page.getByText(/^Vodka Bottle ×/).click();
    await page.keyboard.press("4");
    await page.waitForFunction(() => window.__dc2d!.conn.hotbar[3] === "vodka-bottle");
    await page.keyboard.press("Escape");

    const qtyBefore = await page.evaluate(
      () => window.__dc2d!.conn.inventory.find((s) => s.item === "vodka-bottle")!.qty,
    );
    await page.keyboard.press("4");
    await page.waitForTimeout(150);
    expect(
      await page.evaluate(
        () => window.__dc2d!.conn.inventory.find((s) => s.item === "vodka-bottle")!.qty,
      ),
    ).toBe(qtyBefore);
    await page.locator("canvas").first().click({ position: { x: 900, y: 280 } });
    await page.waitForFunction(
      (before) =>
        (window.__dc2d!.conn.inventory.find((s) => s.item === "vodka-bottle")?.qty ?? 0) < before,
      qtyBefore,
    );
  });

  test("safe rooms are door portals, personal rooms nest inside them", async ({ page }) => {
    test.setTimeout(90_000);
    await openGame(page);

    // Route around the proving-ground structures to the entrance kiosk.
    await walkTo(page, 34.5, 29.5);
    await walkTo(page, 48.5, 29.5);
    await walkTo(page, 48.5, 55.5);
    await walkTo(page, 54.5, 56.5);
    const door = await findTile(page, T_DOOR_SAFE_ROOM, 8);
    await walkTo(page, door.x, door.y + 0.2, { tolerance: 0.35 });

    // Through the portal: far-away instanced room, sanctuary underfoot.
    await page.keyboard.press("e");
    await page.waitForFunction(() => window.__dc2d!.conn.body!.y > 100_000);
    const inSafeRoom = await page.evaluate(() => {
      const conn = window.__dc2d!.conn;
      return conn.world!.isSanctuary(Math.floor(conn.body!.x), Math.floor(conn.body!.y));
    });
    expect(inSafeRoom).toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: "docs/art-samples/live-safe-room.png" });
    const safeY = (await readState(page)).y;

    // The personal door inside leads to your own room…
    const personal = await findTile(page, T_DOOR_PERSONAL, 10);
    await walkTo(page, personal.x, personal.y, { tolerance: 0.35 });
    await page.keyboard.press("e");
    await page.waitForFunction(
      (limit) => Math.abs(window.__dc2d!.conn.body!.y - limit) > 20,
      safeY,
    );

    // …and exits unwind: personal room → safe room → overworld kiosk.
    const exitA = await findTile(page, T_DOOR_EXIT, 10);
    await walkTo(page, exitA.x, exitA.y, { tolerance: 0.35 });
    await page.keyboard.press("e");
    await page.waitForFunction(
      (limit) => Math.abs(window.__dc2d!.conn.body!.y - limit) < 20,
      safeY,
    );
    const exitB = await findTile(page, T_DOOR_EXIT, 10);
    await walkTo(page, exitB.x, exitB.y, { tolerance: 0.35 });
    await page.keyboard.press("e");
    await page.waitForFunction(() => window.__dc2d!.conn.body!.y < 1_000);
    const back = await readState(page);
    expect(Math.hypot(back.x - door.x, back.y - door.y)).toBeLessThan(2);
  });

  test("reload resumes the same identity and stays playable", async ({ page }) => {
    const before = await openGame(page);
    await holdKey(page, "d", 600);
    const moved = await readState(page);

    await page.reload();
    await page.waitForFunction(
      () => window.__dc2d?.conn.status === "connected" && window.__dc2d.conn.body !== null,
    );
    const after = await readState(page);
    expect(after.playerId).toBe(before.playerId); // resume token worked
    expect(Math.abs(after.x - moved.x)).toBeLessThan(2); // position kept

    await page.locator("canvas").first().click({ position: { x: 640, y: 200 } });
    await holdKey(page, "a", 600);
    const afterMove = await readState(page);
    expect(afterMove.x).toBeLessThan(after.x - 2); // inputs accepted post-resume
  });

  test("dev harness: god + teleport to a raised section, climb its staircase", async ({
    page,
  }) => {
    await openGame(page);

    // Find a terrace stair entry at this fixed seed by scanning the
    // world through the client's own deterministic generator: the only
    // odd-height stairs in the wild are raised-section entries.
    const spot = await page.evaluate(() => {
      const conn = window.__dc2d!.conn;
      conn.debugGod(true);
      const w = conn.world!;
      // Prefer an entry approached from the SOUTH (it wears the full
      // south-face staircase object — the screenshot below is the
      // standing visual proof); fall back to any entry.
      let fallback: { stairX: number; stairY: number; lowX: number; lowY: number } | null = null;
      for (let r = 2; r <= 8; r++) {
        for (let cy = -r; cy <= r; cy++) {
          for (let cx = -r; cx <= r; cx++) {
            if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
            for (let ly = 0; ly < 32; ly++) {
              for (let lx = 0; lx < 32; lx++) {
                const x = cx * 32 + lx;
                const y = cy * 32 + ly;
                if (w.tileAt(x, y) !== 2 || Math.abs(w.heightAt(x, y) - 1) > 0.01) continue;
                // A true entry: low floor in front of the step AND the
                // terrace top directly behind it — the walk must cross
                // the step ALONG its climb axis, not sideways.
                for (const [dx, dy] of [
                  [0, 1],
                  [0, -1],
                  [1, 0],
                  [-1, 0],
                ] as const) {
                  if (w.tileAt(x + dx, y + dy) !== 0) continue;
                  if (w.heightAt(x + dx, y + dy) > 0.01) continue;
                  if (w.tileAt(x - dx, y - dy) !== 0) continue;
                  if (Math.abs(w.heightAt(x - dx, y - dy) - 2) > 0.01) continue;
                  const found = { stairX: x, stairY: y, lowX: x + dx + 0.5, lowY: y + dy + 0.5 };
                  if (dy === 1) return found;
                  fallback = fallback ?? found;
                }
              }
            }
          }
        }
      }
      return fallback;
    });
    expect(spot).not.toBeNull();

    // Teleport to the approach tile (a debug intent the server honors
    // because the e2e server runs with DEBUG_COMMANDS=1).
    await page.evaluate(({ lowX, lowY }) => {
      window.__dc2d!.conn.debugTeleport(lowX, lowY);
    }, spot!);
    await page.waitForFunction(
      ({ lowX, lowY }) => {
        const b = window.__dc2d!.conn.body;
        return b !== null && Math.hypot(b.x - lowX, b.y - lowY) < 1;
      },
      spot!,
      { timeout: 5000 },
    );
    const arrived = await readState(page);
    expect(arrived.z).toBeCloseTo(0.8, 1);
    await page.waitForTimeout(400); // terrain chunks build in
    await page.screenshot({ path: "docs/art-samples/live-terrace-stairs.png" });

    // Walk up the staircase with real keys: 0 → 1 → 2, never airborne.
    const key =
      spot!.stairY < Math.floor(spot!.lowY) ? "w" : spot!.stairY > Math.floor(spot!.lowY) ? "s" : spot!.stairX < Math.floor(spot!.lowX) ? "a" : "d";
    await page.locator("canvas").first().click({ position: { x: 640, y: 200 } });
    await holdKey(page, key, 900);
    const onTop = await readState(page);
    expect(onTop.grounded).toBe(true);
    expect(onTop.z).toBeCloseTo(2, 1); // standing atop the raised section
  });
});
