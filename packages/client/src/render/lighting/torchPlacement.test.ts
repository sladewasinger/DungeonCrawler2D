// Headless tests for torch candidate scanning + hash-bucket spacing, against a small
// hand-built grid (no engine World needed — faces.ts's TerrainRead is structural).
import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { selectTorchPositions, TORCH_SPACING_TILES, torchCandidates } from "./torchPlacement.js";

/** A 1-row-thick horizontal corridor: wall at y=1 fronting floor at y=2, for x in [x0,x1). */
function corridorWorld(x0: number, x1: number) {
  return {
    tileAt(wx: number, wy: number) {
      if (wx < x0 || wx >= x1) return TILE.Floor;
      return wy === 1 ? TILE.Wall : TILE.Floor;
    },
    heightAt(wx: number, wy: number) {
      if (wx < x0 || wx >= x1) return 0;
      return wy === 1 ? 2 : 0;
    },
  };
}

describe("torchCandidates", () => {
  it("finds only the wall cells that front open ground to their south", () => {
    const world = corridorWorld(5, 15);
    const candidates = torchCandidates(world, 0, 0, 20, 4);
    expect(candidates.every((c) => c.wy === 1 && c.wx >= 5 && c.wx < 15)).toBe(true);
    expect(candidates).toHaveLength(10);
  });
});

describe("selectTorchPositions", () => {
  it("spaces a long run of candidates into multiple, non-adjacent torches", () => {
    // Run spans 3 spacing buckets, so at least 3 torches regardless of the tuning value.
    const runStart = TORCH_SPACING_TILES;
    const world = corridorWorld(runStart, runStart + TORCH_SPACING_TILES * 3);
    const picked = selectTorchPositions(torchCandidates(world, 0, 0, runStart + TORCH_SPACING_TILES * 4, 4));
    expect(picked.length).toBeGreaterThanOrEqual(3);
    const xs = [...picked.map((p) => p.wx)].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1];
      const b = xs[i];
      if (a === undefined || b === undefined) continue;
      expect(b - a).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic across repeated calls with the same input", () => {
    const candidates = torchCandidates(corridorWorld(0, 30), 0, 0, 30, 4);
    expect(selectTorchPositions(candidates)).toEqual(selectTorchPositions(candidates));
  });

  it("returns nothing for an empty candidate list", () => {
    expect(selectTorchPositions([])).toEqual([]);
  });
});
