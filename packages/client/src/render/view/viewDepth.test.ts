// Depth-sort ordering per orientation: which of two entities draws "in front" (later)
// flips when the orientation flips which world direction faces screen-south.
import { describe, expect, it } from "vitest";
import { compareViewDepth, depthForViewEntity, viewSpaceFeetY } from "./viewDepth.js";

describe("viewSpaceFeetY", () => {
  it("matches world Y at orientation 0 (regression lock, same as viewTransform's)", () => {
    expect(viewSpaceFeetY(3, 7, 0)).toBe(7);
  });

  it("a world-south entity is still 'in front' at orientation 0", () => {
    const north = viewSpaceFeetY(0, -5, 0);
    const south = viewSpaceFeetY(0, 5, 0);
    expect(south).toBeGreaterThan(north);
  });

  it("flips at orientation 180 — the world-north entity is now the one in front", () => {
    const north = viewSpaceFeetY(0, -5, 180);
    const south = viewSpaceFeetY(0, 5, 180);
    expect(north).toBeGreaterThan(south);
  });
});

describe("depthForViewEntity / compareViewDepth", () => {
  it("orders two entities north-to-south, front-most last, at orientation 0", () => {
    const north = { feetWorldX: 0, feetWorldY: -3 };
    const south = { feetWorldX: 0, feetWorldY: 3 };
    expect(depthForViewEntity(south, 0)).toBeGreaterThan(depthForViewEntity(north, 0));
    const sorted = [south, north].sort(compareViewDepth(0));
    expect(sorted).toEqual([north, south]);
  });

  it("the sort order reverses once rotated 180", () => {
    const north = { feetWorldX: 0, feetWorldY: -3 };
    const south = { feetWorldX: 0, feetWorldY: 3 };
    const sorted = [south, north].sort(compareViewDepth(180));
    expect(sorted).toEqual([south, north]);
  });

  it("at 90, an east/west pair sorts by which one currently faces screen-south (world-west)", () => {
    const east = { feetWorldX: 3, feetWorldY: 0 };
    const west = { feetWorldX: -3, feetWorldY: 0 };
    // screenSouthWorldDirection(90) is West, so the west entity should draw in front.
    expect(depthForViewEntity(west, 90)).toBeGreaterThan(depthForViewEntity(east, 90));
  });

  it("a same-row lift tie-break still nudges depth forward at any orientation", () => {
    const grounded = { feetWorldX: 0, feetWorldY: 2, liftUnits: 0 };
    const airborne = { feetWorldX: 0, feetWorldY: 2, liftUnits: 3 };
    for (const o of [0, 90, 180, 270] as const) {
      expect(depthForViewEntity(airborne, o)).toBeGreaterThan(depthForViewEntity(grounded, o));
    }
  });
});
