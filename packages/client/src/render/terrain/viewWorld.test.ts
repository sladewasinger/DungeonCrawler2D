import { describe, expect, it } from "vitest";
import { TILE, ZONE, type TileType } from "@dc2d/engine";
import { viewChunkWorldOrigin, viewWorld } from "./viewWorld.js";
import type { TerrainWorld } from "./terrainWorld.js";

function fakeWorld(tileAt: (wx: number, wy: number) => TileType): TerrainWorld {
  return {
    tileAt: (wx, wy) => tileAt(wx, wy),
    heightAt: (wx, wy) => wx + wy * 100, // distinguishable per-cell scalar
    zoneAt: () => ZONE.None,
    isSanctuary: () => false,
    isWalkable: (wx, wy) => tileAt(wx, wy) !== TILE.Wall,
    groundAt: (wx, wy) => wx + wy * 100,
  };
}

describe("viewWorld at orientation 0", () => {
  it("is a pure passthrough — identical results to the real world at every cell", () => {
    const world = fakeWorld((wx, wy) => (wx === 5 && wy === 5 ? TILE.Wall : TILE.Floor));
    const vw = viewWorld(world, 0);
    for (let wy = 0; wy < 10; wy++) {
      for (let wx = 0; wx < 10; wx++) {
        expect(vw.tileAt(wx, wy)).toBe(world.tileAt(wx, wy));
        expect(vw.heightAt(wx, wy)).toBe(world.heightAt(wx, wy));
      }
    }
  });
});

describe("viewWorld at orientation 90", () => {
  it("reads its screen-south neighbor from the world's real screen-south direction (west, per directionRemap's own table)", () => {
    // viewTileToWorld({x:5,y:5}, 90) = floor(viewToWorld(5.5, 5.5)) = (-6, 5), and the
    // view-space "one step south" neighbor — view (5,6) — maps to (-7, 5): exactly one
    // step WEST of (5,5)'s own real cell, matching screenSouthWorldDirection(90) === "W".
    const world = fakeWorld((wx, wy) => (wx === -7 && wy === 5 ? TILE.Wall : TILE.Floor));
    const vw = viewWorld(world, 90);
    expect(vw.tileAt(5, 6)).toBe(TILE.Wall); // view-space "one south" of (5,5)
    expect(vw.tileAt(5, 5)).toBe(TILE.Floor);
  });

  it("heightAt/groundAt agree with the real world's cell at the mapped position", () => {
    const world = fakeWorld(() => TILE.Floor);
    const vw = viewWorld(world, 90);
    // viewTileToWorld({x:2,y:3}, 90) = floor(viewToWorld(2.5, 3.5)) = (-4, 2) — the
    // tile-index mapping, one cell past the pure rotation of the bare index, in
    // lockstep with every interior point of the cell (see viewTransform.test.ts).
    expect(vw.heightAt(2, 3)).toBe(world.heightAt(-4, 2));
    expect(vw.groundAt(2, 3)).toBe(world.groundAt(-4, 2));
  });
});

describe("viewChunkWorldOrigin", () => {
  it("is the identity at orientation 0", () => {
    expect(viewChunkWorldOrigin(16, 32, 16, 0)).toEqual({ x: 16, y: 32 });
  });

  it("finds the correct min corner at 90/180/270 for a chunk at the origin", () => {
    // 16x16 chunk at view (0,0)..(16,16). Corners rotate but the square's min corner
    // must always land back on an axis-aligned CHUNK_SIZE square in world space.
    for (const orientation of [90, 180, 270] as const) {
      const origin = viewChunkWorldOrigin(0, 0, 16, orientation);
      expect(Number.isInteger(origin.x)).toBe(true);
      expect(Number.isInteger(origin.y)).toBe(true);
    }
  });

  it("every view-tile in the chunk maps to a real-world cell inside the returned [origin, origin+size) square", () => {
    const size = 16;
    for (const orientation of [0, 90, 180, 270] as const) {
      const baseVX = 32;
      const baseVY = -16;
      const vw = viewWorld(fakeWorld(() => TILE.Floor), orientation);
      const origin = viewChunkWorldOrigin(baseVX, baseVY, size, orientation);
      for (let ly = 0; ly < size; ly++) {
        for (let lx = 0; lx < size; lx++) {
          const real = vw.toReal(baseVX + lx, baseVY + ly);
          expect(real.x).toBeGreaterThanOrEqual(origin.x);
          expect(real.x).toBeLessThan(origin.x + size);
          expect(real.y).toBeGreaterThanOrEqual(origin.y);
          expect(real.y).toBeLessThan(origin.y + size);
        }
      }
    }
  });
});
