import { describe, expect, it } from "vitest";
import { TILE } from "@dc2d/engine";
import { hasWallMaterialAtScreen, pitFaceGradientAlpha, southFaceColor } from "./drawWallTile.js";

function terrain(heights: Record<string, number>) {
  return {
    heightAt: (x: number, y: number) => heights[`${x},${y}`] ?? 0,
    tileAt: () => TILE.Floor,
  };
}

describe("pit face shading", () => {
  it("keeps exposed south faces in the purple wall palette, separate from gray floor caps", () => {
    const [r, g, b] = [(southFaceColor() >> 16) & 0xff, (southFaceColor() >> 8) & 0xff, southFaceColor() & 0xff];
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("darkens lower pit-face rows more than their upper rows", () => {
    expect(pitFaceGradientAlpha(2 / 3, false)).toBeGreaterThan(pitFaceGradientAlpha(1 / 3, false));
    expect(pitFaceGradientAlpha(1, false)).toBeGreaterThan(pitFaceGradientAlpha(2 / 3, false));
  });

  it("gives a clipped deep face its strongest end shade", () => {
    expect(pitFaceGradientAlpha(1, true)).toBeGreaterThan(pitFaceGradientAlpha(1, false));
  });

  it("uses one uniform face color across every row of a wall column", () => {
    expect(southFaceColor()).toBe(0x4a4a70);
  });

  it("recognizes every row of a freestanding height column as one continuous wall face", () => {
    const world = terrain({ "5,5": 2 });
    expect(hasWallMaterialAtScreen(world, 5, 4)).toBe(true);
    expect(hasWallMaterialAtScreen(world, 5, 5)).toBe(true);
  });
});
