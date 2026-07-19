// Door structures: explicit footprints suppress every terrain layer beneath the
// assembly, ownership is unambiguous at chunk seams, and non-door tiles are
// never suppressed.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { buildStructureMap, tileKey } from "./structures.js";

function tiles(
  doorAt: { x: number; y: number },
  doorTile: TileType = TILE.DoorSafeRoom,
): (wx: number, wy: number) => TileType {
  return (wx, wy) => (wx === doorAt.x && wy === doorAt.y ? doorTile : TILE.Wall);
}

describe("buildStructureMap", () => {
  it("a door suppresses its own cell, the leaf cell above, and the lintel cell", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 6 }, TILE.DoorPersonal), 0, 0, 32, 32);
    expect(map.doors).toEqual([{ wx: 5, wy: 6, tile: TILE.DoorPersonal }]);
    expect(map.suppressed.has(tileKey(5, 6))).toBe(true);
    expect(map.suppressed.has(tileKey(5, 5))).toBe(true);
    expect(map.suppressed.has(tileKey(5, 4))).toBe(true);
    expect(map.suppressed.has(tileKey(4, 6))).toBe(false);
    expect(map.suppressed.has(tileKey(5, 7))).toBe(false);
    for (const x of [3, 4, 6, 7]) expect(map.faceSuppressed.has(tileKey(x, 6))).toBe(true);
  });

  it("a safe-room door owns the complete 5x3 masonry facade", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 6 }), 0, 0, 32, 32);
    for (let y = 4; y <= 6; y++) {
      for (let x = 3; x <= 7; x++) expect(map.suppressed.has(tileKey(x, y))).toBe(true);
    }
    expect(map.faceSuppressed.size).toBe(0);
  });

  it("a door just south of the range still suppresses the cells it reaches into, but is not drawn here", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 33 }), 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.suppressed.has(tileKey(5, 31))).toBe(true);
  });

  it("leaves a north-wall face intact when a room door sits one row inside it", () => {
    const tileAt = (wx: number, wy: number) => {
      if (wx === 5 && wy === 6) return TILE.DoorExit;
      return wy === 5 ? TILE.Wall : TILE.Floor;
    };
    const map = buildStructureMap(tileAt, 0, 0, 10, 10);
    expect(map.faceSuppressed.size).toBe(0);
  });

  it("no doors, no suppression", () => {
    const map = buildStructureMap(() => TILE.Wall, 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.suppressed.size).toBe(0);
    expect(map.faceSuppressed.size).toBe(0);
  });
});
