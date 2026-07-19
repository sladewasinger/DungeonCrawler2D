// Headless tests for the entity depth-sort comparator — no Phaser involved.
import { describe, expect, it } from "vitest";
import { compareEntityDepth, depthForEntity, depthForOccluder } from "./depthSort.js";

describe("depthForEntity", () => {
  it("increases monotonically with feet Y", () => {
    const ys = [-500, -10, -1, 0, 1, 10, 500];
    let previousDepth = -Infinity;
    for (const y of ys) {
      const depth = depthForEntity(y);
      expect(depth).toBeGreaterThan(previousDepth);
      previousDepth = depth;
    }
  });

  it("keeps distant room coordinates on distinct rows", () => {
    expect(depthForEntity(4096)).toBeGreaterThan(depthForEntity(4095));
    expect(depthForEntity(-4095)).toBeGreaterThan(depthForEntity(-4096));
  });

  it("a same-row airborne lift nudges depth forward but never as much as one row", () => {
    const grounded = depthForEntity(10, 0);
    const airborne = depthForEntity(10, 3);
    const nextRow = depthForEntity(11, 0);
    expect(airborne).toBeGreaterThan(grounded);
    expect(airborne).toBeLessThan(nextRow);
  });
});

describe("depthForOccluder", () => {
  it("places a wall in front of north feet and behind south feet", () => {
    const wall = depthForOccluder(10);
    expect(wall).toBeGreaterThan(depthForEntity(9.99));
    expect(wall).toBeLessThan(depthForEntity(10.01));
  });
});

describe("compareEntityDepth", () => {
  it("sorts entities north-to-south, front-most last", () => {
    const entries = [{ feetWorldY: 5 }, { feetWorldY: -3 }, { feetWorldY: 0 }];
    const sorted = [...entries].sort(compareEntityDepth);
    expect(sorted.map((e) => e.feetWorldY)).toEqual([-3, 0, 5]);
  });

  it("agrees with depthForEntity's sign", () => {
    const a = { feetWorldY: 2, liftUnits: 1 };
    const b = { feetWorldY: 2, liftUnits: 0 };
    expect(Math.sign(compareEntityDepth(a, b))).toBe(Math.sign(depthForEntity(2, 1) - depthForEntity(2, 0)));
  });
});
