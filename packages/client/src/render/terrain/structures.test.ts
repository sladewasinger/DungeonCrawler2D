// Door structures: no suppression footprint (leaves ordinary terrain art intact
// underneath), ownership at chunk seams is unambiguous, faceSuppressed is untouched.
import { TILE, type TileType } from "@dc2d/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { depthForOccluder } from "../entities/depthSort.js";
import { buildStructureMap, createDoorLabel, tileKey } from "./structures.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function tiles(
  doorAt: { x: number; y: number },
  doorTile: TileType = TILE.DoorSafeRoom,
): (wx: number, wy: number) => TileType {
  return (wx, wy) => (wx === doorAt.x && wy === doorAt.y ? doorTile : TILE.Floor);
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
      return wy === 6 ? TILE.Void : TILE.Floor;
    };
    const map = buildStructureMap(tileAt, 0, 0, 10, 10);
    expect(map.faceSuppressed.size).toBe(0);
  });

  it("no doors, no suppression", () => {
    const map = buildStructureMap(() => TILE.Floor, 0, 0, 32, 32);
    expect(map.doors).toEqual([]);
    expect(map.suppressed.size).toBe(0);
    expect(map.faceSuppressed.size).toBe(0);
  });
});

describe("door labels", () => {
  it("renders labels directly in display space instead of into a scaled terrain page", () => {
    vi.stubGlobal("window", { devicePixelRatio: 3 });
    const text = {
      setOrigin: vi.fn(() => text),
      setStroke: vi.fn(() => text),
      setDepth: vi.fn(() => text),
      setName: vi.fn(() => text),
      setVisible: vi.fn(() => text),
    };
    const add = { text: vi.fn(() => text) };

    const label = createDoorLabel(
      { add } as never,
      { wx: 5, wy: 6, tile: TILE.DoorSafeRoom },
    );

    expect(label).toBe(text);
    expect(add.text).toHaveBeenCalledWith(
      264,
      284,
      "SAFE ROOM",
      expect.objectContaining({ fontSize: "9px", resolution: 3 }),
    );
    expect(text.setStroke).toHaveBeenCalledWith("#11111a", 3);
    expect(text.setDepth).toHaveBeenCalledWith(depthForOccluder(7) + 0.01);
    expect(text.setVisible).toHaveBeenCalledWith(false);
  });

  it("does not allocate a label for an unlabeled door", () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const add = { text: vi.fn() };
    expect(createDoorLabel(
      { add } as never,
      { wx: 5, wy: 6, tile: TILE.DoorPersonal },
    )).toBeNull();
    expect(add.text).not.toHaveBeenCalled();
  });
});
