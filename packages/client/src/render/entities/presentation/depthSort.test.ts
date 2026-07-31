// Headless tests for the entity depth-sort comparator — no Phaser involved.
import { describe, expect, it } from "vitest";
import {
  compareEntityDepth,
  depthForCombatGeometry,
  depthForCombatOverlay,
  depthForCombatReachOverlay,
  depthForEntity,
  depthForOccluder,
} from "./depthSort.js";

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

  it("an entity standing on a raised platform south of a wall still draws in front of it, elevation aside", () => {
    // Epic 7.13 z-lift: a platform's height is carried entirely by the sprite's screen
    // Y offset (lift.ts), never by feetWorldY or the liftUnits tie-break — so a player
    // on a z1 platform sorts against nearby walls exactly like a z0 player would.
    const wallRow = 10;
    const wall = depthForOccluder(wallRow);
    const onPlatformJustSouth = depthForEntity(wallRow + 0.01, 0);
    const onPlatformJustNorth = depthForEntity(wallRow - 0.01, 0);
    expect(onPlatformJustSouth).toBeGreaterThan(wall);
    expect(onPlatformJustNorth).toBeLessThan(wall);
  });
});

describe("compareEntityDepth", () => {
  it("sorts entities north-to-south, front-most last", () => {
    const entries = [{ feetWorldY: 5 }, { feetWorldY: -3 }, { feetWorldY: 0 }];
    const sorted = [...entries].sort(compareEntityDepth);
    expect(sorted.map((e) => e.feetWorldY)).toEqual([-3, 0, 5]);
  });

});

describe("combat overlay depth", () => {
  it("renders attack and guard geometry above the immediate screen-south terrain row", () => {
    const terrainDepth = depthForOccluder(11);
    const overlay = depthForCombatOverlay({ wielderViewY: 10.3, wielderDepth: depthForEntity(10.3) });
    expect(depthForCombatGeometry(overlay)).toBeGreaterThan(terrainDepth + 0.1);
  });

  it("stays above the south row even when that terrain is higher than the wielder", () => {
    const terrainDepth = depthForOccluder(11);
    const overlay = depthForCombatOverlay({ wielderViewY: 10.3, wielderDepth: depthForEntity(10.3, 2) });
    expect(depthForCombatGeometry(overlay)).toBeGreaterThan(terrainDepth);
  });

  it("clears every screen-south row touched by a 2.4-tile attack", () => {
    const farthestSouthEdge = depthForOccluder(13);
    const overlay = depthForCombatReachOverlay({
      wielderViewY: 10.3,
      wielderDepth: depthForEntity(10.3),
      reachTiles: 2.4,
    });
    expect(depthForCombatGeometry(overlay)).toBeGreaterThan(farthestSouthEdge);
  });

  it("uses orientation-resolved view Y, including negative rows", () => {
    const farthestSouthEdge = depthForOccluder(-5);
    const overlay = depthForCombatReachOverlay({
      wielderViewY: -7.6,
      wielderDepth: depthForEntity(-7.6),
      reachTiles: 2.4,
    });
    expect(depthForCombatGeometry(overlay)).toBeGreaterThan(farthestSouthEdge);
  });
});
