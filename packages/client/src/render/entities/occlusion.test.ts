// Headless tests for the occlusion heuristic — no Phaser involved (syncOcclusionSilhouette's
// Phaser glue is exercised via the manual zoomed screenshot proof instead).
import { describe, expect, it } from "vitest";
import type { WorldView } from "@dc2d/engine";
import { isOccludedByWallAhead } from "./occlusion.js";

function fakeWorld(walls: Record<string, number>): WorldView {
  return {
    isWalkable: (x, y) => walls[`${x},${y}`] === undefined,
    heightAt: (x, y) => walls[`${x},${y}`] ?? 0,
    groundAt: () => 0,
  };
}

describe("isOccludedByWallAhead", () => {
  it("is false with no walls nearby", () => {
    expect(isOccludedByWallAhead(fakeWorld({}), 5.5, 5.5, 0)).toBe(false);
  });

  it("is true when a tall wall sits at the entity's own tile", () => {
    expect(isOccludedByWallAhead(fakeWorld({ "5,5": 2 }), 5.5, 5.5, 0)).toBe(true);
  });

  it("is true when a tall wall sits up to 2 rows south (its cap art bleeds north onto this row)", () => {
    expect(isOccludedByWallAhead(fakeWorld({ "5,7": 2 }), 5.5, 5.5, 0)).toBe(true);
  });

  it("is false when the wall is more than 2 rows south, out of cap-bleed range", () => {
    expect(isOccludedByWallAhead(fakeWorld({ "5,8": 2 }), 5.5, 5.5, 0)).toBe(false);
  });

  it("is false when the nearby solid tile is flush with the entity's own height (a curb, not a wall face)", () => {
    expect(isOccludedByWallAhead(fakeWorld({ "5,6": 0.1 }), 5.5, 5.5, 0)).toBe(false);
  });

  it("stops reading a wall as tall once the entity climbs near its height", () => {
    expect(isOccludedByWallAhead(fakeWorld({ "5,6": 2 }), 5.5, 5.5, 1.8)).toBe(false);
  });
});
