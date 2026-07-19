// Door structures: no suppression footprint (leaves ordinary terrain art intact
// underneath), ownership at chunk seams is unambiguous, faceSuppressed is untouched.
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
  it("a door never suppresses any terrain cell — its own, or a kiosk terrace's top platform above it", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 6 }, TILE.DoorPersonal), 0, 0, 32, 32);
    expect(map.doors).toEqual([{ wx: 5, wy: 6, tile: TILE.DoorPersonal }]);
    expect(map.suppressed.size).toBe(0);
    for (const x of [3, 4, 6, 7]) expect(map.faceSuppressed.has(tileKey(x, 6))).toBe(true);
  });

  it("a safe-room door owns no masonry facade and suppresses nothing around it", () => {
    const map = buildStructureMap(tiles({ x: 5, y: 6 }), 0, 0, 32, 32);
    expect(map.suppressed.size).toBe(0);
    expect(map.faceSuppressed.size).toBe(0);
  });

  it("a door outside the x-range still contributes faceSuppressed cells it reaches into, but is not drawn here", () => {
    const map = buildStructureMap(tiles({ x: 33, y: 5 }, TILE.DoorPersonal), 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.faceSuppressed.has(tileKey(31, 5))).toBe(true);
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
