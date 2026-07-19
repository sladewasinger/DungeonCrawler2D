// Door structures: explicit footprints suppress every terrain layer beneath the
// assembly, ownership is unambiguous at chunk seams, and non-door tiles are
// never suppressed.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { buildStructureMap, tileKey } from "./structures.js";

function tiles(doorAt: { x: number; y: number }): (wx: number, wy: number) => TileType {
  return (wx, wy) => (wx === doorAt.x && wy === doorAt.y ? TILE.DoorSafeRoom : TILE.Wall);
}

describe("buildStructureMap", () => {
  it("a door suppresses its own cell, the leaf cell above, and the lintel cell", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 6 }), 0, 0, 32, 32);
    expect(map.doors).toEqual([{ wx: 5, wy: 6 }]);
    expect(map.suppressed.has(tileKey(5, 6))).toBe(true);
    expect(map.suppressed.has(tileKey(5, 5))).toBe(true);
    expect(map.suppressed.has(tileKey(5, 4))).toBe(true);
    expect(map.suppressed.has(tileKey(4, 6))).toBe(false);
    expect(map.suppressed.has(tileKey(5, 7))).toBe(false);
  });

  it("a door just south of the range still suppresses the cells it reaches into, but is not drawn here", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 33 }), 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.suppressed.has(tileKey(5, 31))).toBe(true);
  });

  it("no doors, no suppression", () => {
    const map = buildStructureMap(() => TILE.Wall, 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.suppressed.size).toBe(0);
  });
});
