import { expect, test } from "@playwright/test";
import { CLIENT_URL } from "./env.js";

/**
 * The Epic 7.11 effects showcase/test bench: paints straight into the live bench sim via
 * window.__editorStore (established pattern — the Phaser canvas ignores synthetic input,
 * so this is the documented alternative for the editor/bench surface specifically; the
 * main game specs in this suite still drive everything through real keyboard/mouse).
 * Asserts a real SIMULATE tick actually spreads fire across painted oil — the same
 * AreaSystem.tick the live game-server runs, ticking client-side with no network.
 */

const ORIGIN_X = 5;
const Y = 10;
const OIL_TILES = [0, 1, 2, 3, 4]; // x = ORIGIN_X..ORIGIN_X+4, all default-floor and walkable

test.describe("effects bench: paint oil + fire, SIMULATE spreads it", () => {
  test("fire painted onto one end of an oil line spreads onto the next oil tile", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(`${CLIENT_URL}/?scene=editor&debug=1`);
    await page.waitForFunction(() => window.__editorStore !== undefined, undefined, { timeout: 10_000 });

    await page.evaluate(
      ({ originX, y, tiles }) => {
        const store = window.__editorStore!;
        store.brush = { kind: "area", areaId: "area-oil" };
        for (const dx of tiles) store.paint(originX + dx, y);
        // Painting fire directly onto an already-oil tile is a same-tile "meeting"
        // (engine/src/areas/system.ts's AREA_MEETS: fire+oil -> area-fire), not a
        // spread — it's the deterministic ignition point SIMULATE then spreads from.
        store.brush = { kind: "area", areaId: "area-fire" };
        store.paint(originX, y);
      },
      { originX: ORIGIN_X, y: Y, tiles: OIL_TILES },
    );

    const ignited = await page.evaluate(
      ({ originX, y }) => window.__editorStore!.bench.areas.defAt(originX, y),
      { originX: ORIGIN_X, y: Y },
    );
    expect(ignited).toBe("area-fire");

    await page.evaluate(() => window.__editorStore!.toggleSimulate());
    await page.waitForFunction(() => window.__editorStore!.bench.running === true);

    // Fixed bench RNG seed (state.ts's BENCH_RNG_SEED = 1337) makes this a deterministic
    // outcome, not a flaky probability roll — the generous timeout is only for real
    // wall-clock tick pacing (SIMULATE runs at the server's TICK_RATE via requestAnimationFrame).
    await page.waitForFunction(
      ({ originX, y }) => {
        const areas = window.__editorStore!.bench.areas;
        return [1, 2, 3, 4].some((dx) => areas.defAt(originX + dx, y) === "area-fire");
      },
      { originX: ORIGIN_X, y: Y },
      { timeout: 20_000, polling: 250 },
    );
  });
});

declare global {
  interface Window {
    __editorStore?: {
      brush: { kind: "area"; areaId: string } | Record<string, unknown>;
      paint(wx: number, wy: number): void;
      toggleSimulate(): void;
      bench: {
        running: boolean;
        tickCount: number;
        areas: { defAt(x: number, y: number): string | null };
      };
    };
  }
}
