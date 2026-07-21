// Headless tests for the occlusion heuristic — no Phaser involved (syncOcclusionSilhouette's
// Phaser glue is exercised via the manual zoomed screenshot proof instead).
import { describe, expect, it } from "vitest";
import type { WorldView } from "@dc2d/engine";
import { isOccludedByTerrainAhead } from "./occlusion.js";

function fakeWorld(heights: Record<string, number>): WorldView {
  return {
    // isWalkable is irrelevant to isOccludedByTerrainAhead now — WAVE R2's whole point
    // is that a walkable floor rim occludes exactly like an unwalkable wall face does.
    isWalkable: () => true,
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    groundAt: () => 0,
    stairHeightAt: () => null,
  };
}

describe("isOccludedByTerrainAhead", () => {
  it("is false with no terrain nearby", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({}), 5.5, 5.5, 0, 0)).toBe(false);
  });

  it("ignores the entity's own tile — collision forbids standing inside a wall", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,5": 2 }), 5.5, 5.5, 0, 0)).toBe(false);
  });

  it("is true for a z1 wall one row south (its body reaches this row)", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 1 }), 5.5, 5.5, 0, 0)).toBe(true);
  });

  it("is FALSE for a z1 wall two rows south — its art can't reach this far north (user false-positive, 2026-07-20)", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,7": 1 }), 5.5, 5.5, 0, 0)).toBe(false);
  });

  it("is true when a tall wall sits up to 2 rows south (its cap art bleeds north onto this row)", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,7": 2 }), 5.5, 5.5, 0, 0)).toBe(true);
  });

  it("is false when the wall is more than 2 rows south, out of cap-bleed range", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,8": 2 }), 5.5, 5.5, 0, 0)).toBe(false);
  });

  it("is false when the nearby solid tile is flush with the entity's own height (a curb, not a wall face)", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 0.1 }), 5.5, 5.5, 0, 0)).toBe(false);
  });

  it("stops reading a wall as tall once the entity climbs near its height", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 2 }), 5.5, 5.5, 1.8, 0)).toBe(false);
  });

  // WAVE R2 (floor-rim occlusion): a walkable z0 floor rim, not a wall at all,
  // between a pit-dwelling entity and the camera must occlude exactly like a
  // wall face would — this is the generalization's whole point.
  it("occludes for a WALKABLE floor rim one row south of a z-1 pit entity", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 0 }), 5.5, 5.5, -1, 0)).toBe(true);
  });

  it("does not occlude across flush, walkable-and-flat ground", () => {
    expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 0 }), 5.5, 5.5, 0, 0)).toBe(false);
  });

  // Occlusion is screen-relative: at orientation 0, world-south (+y) is screen-south;
  // rotating 180 flips it to world-north (-y), matching directionRemap.ts's
  // screenSouthWorldDirection so a rim behind the camera at one orientation is the
  // rim ahead of it at another.
  it("reads world-north as the occluding side once the view is rotated 180", () => {
    const world = fakeWorld({ "5,4": 1 });
    expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 0, 0)).toBe(false);
    expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 0, 180)).toBe(true);
  });

  it("reads world-west as the occluding side at orientation 90 (screenSouthWorldDirection(90) === W)", () => {
    const world = fakeWorld({ "4,5": 1 });
    expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 0, 0)).toBe(false);
    expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 0, 90)).toBe(true);
  });

  // WAVE E3 exact-test truth table (docs/ELEVATION-PROJECTION.md section 3): each case
  // hand-derived from `heightAt(ahead) - z >= step`, independent of the implementation.
  describe("WAVE E3 exact-test truth table", () => {
    it("pit-behind-rim: a z0 rim one row south of a z-1 pit-dweller occludes (0 - (-1) = 1 >= 1)", () => {
      expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 0 }), 5.5, 5.5, -1, 0)).toBe(true);
    });

    it("z1-entity-behind-z2-wall: a z2 wall one row south of a z1 entity occludes (2 - 1 = 1 >= 1)", () => {
      expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 2 }), 5.5, 5.5, 1, 0)).toBe(true);
    });

    it("z1-entity-behind-z2-wall two rows south does NOT occlude (2 - 1 = 1, needs >= 2)", () => {
      expect(isOccludedByTerrainAhead(fakeWorld({ "5,7": 2 }), 5.5, 5.5, 1, 0)).toBe(false);
    });

    it("tall-platform-vs-short-wall: an entity standing on a z2 platform is NOT occluded by a z1 wall one row south (1 - 2 = -1 >= 1 is false)", () => {
      expect(isOccludedByTerrainAhead(fakeWorld({ "5,6": 1 }), 5.5, 5.5, 2, 0)).toBe(false);
    });

    it("tall-platform-vs-short-wall holds at every orientation (the entity's own height always clears a shorter neighbor)", () => {
      const world = fakeWorld({ "5,4": 1, "4,5": 1, "6,5": 1 });
      expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 2, 180)).toBe(false);
      expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 2, 90)).toBe(false);
      expect(isOccludedByTerrainAhead(world, 5.5, 5.5, 2, 270)).toBe(false);
    });
  });
});
