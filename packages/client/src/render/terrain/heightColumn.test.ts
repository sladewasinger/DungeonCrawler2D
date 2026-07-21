import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { freestandingHeightBodyRows } from "./heightColumn.js";

function terrain(heights: Record<string, number>): TerrainRead {
  return { heightAt: (x, y) => heights[`${x},${y}`] ?? 0, tileAt: () => 0 };
}

describe("freestandingHeightBodyRows", () => {
  it("fills every missing body row of a one-cell-deep z1..z5 height run", () => {
    const heights: Record<string, number> = {};
    for (let x = 1; x <= 5; x++) heights[`${x},5`] = x;
    const world = terrain(heights);
    expect(freestandingHeightBodyRows(world, 1, 5)).toEqual([]);
    expect(freestandingHeightBodyRows(world, 2, 5)).toEqual([1]);
    expect(freestandingHeightBodyRows(world, 3, 5)).toEqual([1, 2]);
    expect(freestandingHeightBodyRows(world, 4, 5)).toEqual([1, 2, 3]);
    expect(freestandingHeightBodyRows(world, 5, 5)).toEqual([1, 2, 3, 4]);
  });

  it("leaves a north-south terrain mass to its existing face-row ownership", () => {
    expect(freestandingHeightBodyRows(terrain({ "3,3": 3, "3,4": 3, "3,5": 3 }), 3, 4)).toEqual([]);
  });
});
