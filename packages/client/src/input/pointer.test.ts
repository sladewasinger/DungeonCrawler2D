// Regression test for the pointer.worldX/worldY reliability audit (docs/ROADMAP.md
// Epic 7.12): cursorWorldTile must transform through the CALLER'S OWN camera, never
// the shared pointer.worldX/worldY — that field is silently rewritten by whichever
// scene's InputPlugin last hit-tested it, and the parallel HudScene's un-zoomed camera
// reliably clobbers it while a HUD panel is open (see pointer.ts's doc comment).
import { describe, expect, it } from "vitest";
import { cursorWorldTile } from "./pointer.js";

describe("cursorWorldTile", () => {
  it("divides the camera's own world-point transform by tilePx", () => {
    const camera = { getWorldPoint: (x: number, y: number) => ({ x: x * 2, y: y * 2 }) };
    expect(cursorWorldTile(camera, { x: 100, y: 50 }, 32)).toEqual({ x: 6.25, y: 3.125 });
  });

  it("stays correct under a zoomed/scrolled camera even when a stale pointer.worldX would be wrong", () => {
    // Simulates a camera zoomed 2x and scrolled — getWorldPoint reflects that
    // transform; a naive pointer.worldX/worldY read (not used here at all) could
    // instead reflect an unrelated, un-zoomed HudScene camera's last hit-test.
    const zoomedScrolledCamera = {
      getWorldPoint: (x: number, y: number) => ({ x: x / 2 + 500, y: y / 2 + 300 }),
    };
    const result = cursorWorldTile(zoomedScrolledCamera, { x: 640, y: 360 }, 32);
    expect(result).toEqual({ x: (320 + 500) / 32, y: (180 + 300) / 32 });
  });

  it("is independent of any pointer.worldX/worldY fields — only pointer.x/y and the camera matter", () => {
    const camera = { getWorldPoint: (x: number, y: number) => ({ x, y }) };
    const pointerWithMisleadingWorldFields = {
      x: 64,
      y: 96,
      // A stale/clobbered value a HudScene camera might have left behind — must be ignored.
      worldX: 999_999,
      worldY: 999_999,
    };
    expect(cursorWorldTile(camera, pointerWithMisleadingWorldFields, 32)).toEqual({ x: 2, y: 3 });
  });
});
