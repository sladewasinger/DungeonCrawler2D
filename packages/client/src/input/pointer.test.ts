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

  // WAVE E3 (docs/ELEVATION-PROJECTION.md section 4): omitting heightAt (or supplying
  // one that reports flat ground everywhere) must stay byte-identical to the pre-E3
  // behavior above — these use the same camera/tilePx as the first test.
  describe("with a heightAt callback", () => {
    const camera = { getWorldPoint: (x: number, y: number) => ({ x: x * 2, y: y * 2 }) };

    it("is byte-identical to the no-callback case when every cell reports height 0", () => {
      expect(cursorWorldTile(camera, { x: 100, y: 50 }, 32, () => 0)).toEqual({ x: 6.25, y: 3.125 });
    });

    it("shifts the aim point onto a taller cap 2 tiles south of the raw view tile (orientation 0)", () => {
      // Raw view tile = floor(6.25, 3.125) = (6, 3). At orientation 0 the tallest-first
      // search's candidate for h is world (6, 3+h) — set height 2 at world (6,5) so the
      // h=2 probe accepts, shifting the continuous view point's y by +2 before viewToWorld
      // (the identity at orientation 0), preserving the .25 sub-tile fraction on x.
      const heightAt = (wx: number, wy: number) => (wx === 6 && wy === 5 ? 2 : 0);
      expect(cursorWorldTile(camera, { x: 100, y: 50 }, 32, heightAt)).toEqual({ x: 6.25, y: 5.125 });
    });
  });
});
