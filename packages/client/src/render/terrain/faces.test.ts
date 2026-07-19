// Face decisions are HEIGHT decisions: south faces exist only over a real drop
// to open ground — never from tile types, never at sub-threshold ramp steps.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { FACE_MIN_DROP, hasPlatformSouthFace, hasSouthFace, type TerrainRead } from "./faces.js";

function terrain(cells: Record<string, { h: number; t?: TileType }>): TerrainRead {
  return {
    heightAt: (x, y) => cells[`${x},${y}`]?.h ?? 0,
    tileAt: (x, y) => cells[`${x},${y}`]?.t ?? TILE.Floor,
  };
}

describe("hasSouthFace", () => {
  it("true over a real drop to open ground", () => {
    const t = terrain({ "0,0": { h: 2, t: TILE.Wall }, "0,1": { h: 0 } });
    expect(hasSouthFace(t, 0, 0)).toBe(true);
  });

  it("false when the south neighbor is wall — internal steps never face", () => {
    const t = terrain({ "0,0": { h: 4, t: TILE.Wall }, "0,1": { h: 2, t: TILE.Wall } });
    expect(hasSouthFace(t, 0, 0)).toBe(false);
  });

  it("false when the drop is below the threshold (ramps, STEP_UP ledges)", () => {
    const t = terrain({ "0,0": { h: 1, t: TILE.Wall }, "0,1": { h: 1 - FACE_MIN_DROP + 0.2 } });
    expect(hasSouthFace(t, 0, 0)).toBe(false);
  });

  it("false for a wall level with its southern neighbor, regardless of tile types", () => {
    const t = terrain({ "0,0": { h: 2, t: TILE.Wall }, "0,1": { h: 2 } });
    expect(hasSouthFace(t, 0, 0)).toBe(false);
  });
});

describe("hasPlatformSouthFace", () => {
  it("a raised walkable dais fronts a cliff band; wall terrain does not qualify", () => {
    const dais = terrain({ "0,0": { h: 2 }, "0,1": { h: 0 } });
    expect(hasPlatformSouthFace(dais, 0, 0)).toBe(true);
    const wall = terrain({ "0,0": { h: 2, t: TILE.Wall }, "0,1": { h: 0 } });
    expect(hasPlatformSouthFace(wall, 0, 0)).toBe(false);
  });
});
