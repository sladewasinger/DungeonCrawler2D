import { expect, test, type Page } from "@playwright/test";
import { openGame } from "./helpers.js";

const MIB = 1024 * 1024;
const TELEPORTS = [
  { x: 4, y: 4 },
  { x: 72, y: 4 },
  { x: 72, y: 72 },
  { x: -72, y: 72 },
  { x: -72, y: -72 },
  { x: 136, y: -72 },
  { x: 136, y: 136 },
  { x: 4, y: 4 },
] as const;

async function waitForTerrain(page: Page) {
  try {
    await page.waitForFunction(() => {
      const diagnostics = window.__dc2d?.terrainDiagnostics();
      return diagnostics !== null &&
        diagnostics !== undefined &&
        diagnostics.loadedChunks > 0 &&
        diagnostics.buildingChunks === 0 &&
        diagnostics.queuedChunks === 0;
    }, undefined, { timeout: 20_000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => window.__dc2d?.terrainDiagnostics() ?? null);
    throw new Error(`terrain did not settle: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  return page.evaluate(() => window.__dc2d?.terrainDiagnostics() ?? null);
}

async function sampleTerrain(
  page: Page,
  position: { readonly x: number; readonly y: number },
  rotate: boolean,
): Promise<number> {
  await page.evaluate(({ x, y }) => window.__dc2d?.conn.debugTeleport(x, y), position);
  if (rotate) await page.keyboard.press("q");
  const diagnostics = await waitForTerrain(page);
  if (!diagnostics) throw new Error("terrain diagnostics unavailable");
  expect(diagnostics.profile).toBe("constrained");
  expect(diagnostics.activeUsedBytes).toBeLessThanOrEqual(diagnostics.activeBytes);
  expect(diagnostics.spareUsedBytes).toBeLessThanOrEqual(diagnostics.spareBytes);
  return diagnostics.activeUsedBytes + diagnostics.spareUsedBytes;
}

test.describe("bounded terrain memory", () => {
  test.use({
    viewport: { width: 900, height: 500 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });

  test("teleports and rotations reach a constrained-device memory plateau", async ({ page }) => {
    test.setTimeout(60_000);
    await openGame(page, "TerrainBudget");
    const samples: number[] = [];
    for (const [index, position] of TELEPORTS.entries()) {
      samples.push(await sampleTerrain(page, position, index % 2 === 1));
    }
    const plateau = samples.slice(-4);
    expect(Math.max(...plateau) - Math.min(...plateau)).toBeLessThanOrEqual(8 * MIB);
    expect(Math.max(...samples)).toBeLessThanOrEqual(96 * MIB);
  });
});
