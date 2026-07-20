import { expect, test, type Locator, type Page } from "@playwright/test";
import { clickHudText } from "./hudInteraction.js";
import { openGame } from "./helpers.js";

/**
 * Two real browser contexts, two real sockets: global chat's "reaches everyone
 * immediately" contract (docs/ROADMAP.md Epic 7.9), and the DM gate — denied as a
 * stranger, then allowed once a real hold-F fistbump (Epic 7.10) seals a mutual
 * contact. Every message goes through the real DOM chat-input overlay with real
 * typed keys, exactly like a player.
 */

/**
 * Every message body is typed with page.keyboard.type() — REAL per-key events, bound
 * hotkey letters (w/a/s/d/e/r/o/f…) included. This is the regression test for the
 * capture bug this suite originally uncovered: Phaser's `addKey()` defaults
 * `preventDefault: true` and ate those letters at the window level even while the DOM
 * chat input had focus. ChatInputBox now suspends Phaser's global capture on focus and
 * restores it on blur (chatInput.ts onFocusChange → keyboard.disableGlobalCapture());
 * if that regresses, the typed text below arrives with letters missing and the
 * message-content assertions fail.
 */
function chatInput(page: Page): Locator {
  return page.locator("input").first();
}

/** Clicks the real Phaser "GLBL" tab first (proves the click-to-switch UI actually
 * works, not just that global is the fresh-session default) — before opening the DOM
 * chat input, since that click would otherwise blur it mid-message. */
async function sendGlobal(page: Page, text: string): Promise<void> {
  await clickHudText(page, "GLBL");
  await page.keyboard.press("Enter");
  await expect(chatInput(page)).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

async function sendCommand(page: Page, text: string): Promise<void> {
  await page.keyboard.press("Enter");
  await expect(chatInput(page)).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

test.describe("chat: global fan-out and the DM contact gate", () => {
  test("a global message crosses sockets; a stranger's /dm is denied until a real fistbump seals a contact", async ({ browser }) => {
    test.setTimeout(60_000);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await openGame(pageA, "Ashling");
    const stateB = await openGame(pageB, "Bramble");

    // Clustered test-server spawns land them within AOI of each other.
    await pageA.waitForFunction(
      (id) => [...window.__dc2d!.conn.entities.keys()].includes(id!),
      stateB.playerId,
      { timeout: 10_000 },
    );

    await sendGlobal(pageA, "hello from the whole floor");
    await pageB.waitForFunction(
      (text) => window.__dc2d!.conn.chatLog.some((l) => l.channel === "global" && l.text === text),
      "hello from the whole floor",
      { timeout: 10_000 },
    );

    // Stranger DM: denied with the exact server-side gate message.
    await sendCommand(pageA, "/dm Bramble not contacts yet");
    await pageA.waitForFunction(
      () =>
        window.__dc2d!.conn.chatLog.some(
          (l) => l.channel === "system" && l.text === "You haven't fistbumped Bramble yet.",
        ),
      undefined,
      { timeout: 10_000 },
    );

    await sealFistbump(pageA, pageB);

    await sendCommand(pageA, "/dm Bramble now we can talk");
    await pageB.waitForFunction(
      () =>
        window.__dc2d!.conn.chatLog.some(
          (l) => l.channel === "dm" && l.text === "now we can talk" && l.name === "Ashling",
        ),
      undefined,
      { timeout: 10_000 },
    );

    await contextA.close();
    await contextB.close();
  });
});

/**
 * Debug-teleports A right beside B, then holds real F keydown on both at once past
 * FISTBUMP_HOLD_MS (400ms). Per ENGINEERING_STANDARDS.md's own testing rule ("using
 * debug teleport, never by wandering") — game-server/src/sim/spawn.ts's cluster spawn
 * snaps each grid slot independently to its OWN nearest walkable tile, so two
 * "adjacent" slots aren't guaranteed to be walk-reachable from each other without
 * pathing around real generated geometry, which this suite has no need to solve.
 */
async function sealFistbump(pageA: Page, pageB: Page): Promise<void> {
  // conn.entities can also hold test-fixture items/hazards in sandbox — must filter to
  // kind "player", not just take entities.values()'s first entry (whatever that happens
  // to be), or the teleport target below could be some unrelated ground item.
  const bPos = await pageA.evaluate(() => {
    const conn = window.__dc2d!.conn;
    for (const remote of conn.entities.values()) {
      if (remote.snap["kind"] === "player") return { x: remote.snap["x"] as number, y: remote.snap["y"] as number };
    }
    throw new Error("sealFistbump: no player entity visible in AOI");
  });
  await pageA.evaluate(({ x, y }) => window.__dc2d!.conn.debugTeleport(x - 1, y), bPos);
  await pageA.waitForFunction(
    ({ x, y }) => {
      const body = window.__dc2d!.conn.body!;
      return Math.hypot(body.x - (x - 1), body.y - y) < 1;
    },
    bPos,
    { timeout: 5_000 },
  );
  await Promise.all([pageA.keyboard.down("f"), pageB.keyboard.down("f")]);
  await pageA.waitForTimeout(700);
  await Promise.all([pageA.keyboard.up("f"), pageB.keyboard.up("f")]);
  await pageA.waitForFunction(
    () => window.__dc2d!.conn.contacts.some((c) => c.name === "Bramble"),
    undefined,
    { timeout: 5_000 },
  );
  await pageB.waitForFunction(
    () => window.__dc2d!.conn.contacts.some((c) => c.name === "Ashling"),
    undefined,
    { timeout: 5_000 },
  );
}
