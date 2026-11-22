import { describe, expect, it } from "vitest";
import { WorldChunkCache } from "../world/collision.js";
import { canPerceiveTarget, computeFlankRingSlot, hasElevationLineOfSight } from "./aiSensing.js";

describe("aiSensing", () => {
  it("blocks line of sight across higher cliff ridges", () => {
    const cache = new WorldChunkCache(1337);
    const losAcrossPlateau = hasElevationLineOfSight({
      cache,
      fromX: -5, fromY: -10, fromElev: 0,
      toX: -15, toY: -10, toElev: 0,
    });
    expect(losAcrossPlateau).toBe(false);
    const openGlade = hasElevationLineOfSight({
      cache,
      fromX: -1, fromY: 1, fromElev: 0,
      toX: 2, toY: 1, toElev: 0,
    });
    expect(openGlade).toBe(true);
  });

  it("rejects distant targets behind the observer vision cone while detecting nearby walkers", () => {
    const cache = new WorldChunkCache(1337);
    const observer = { x: 0.5, y: 0.5, elevation: 0, facingX: 1, facingY: 0 };
    const behindFar = { x: -4.5, y: 0.5, elevation: 0, moving: true };
    const aheadFar = { x: 5.5, y: 0.5, elevation: 0, moving: true };
    expect(canPerceiveTarget({ cache, observer, target: behindFar, visionRange: 9, halfConeRad: 1.05, hearRange: 3.4 })).toBe(false);
    expect(canPerceiveTarget({ cache, observer, target: aheadFar, visionRange: 9, halfConeRad: 1.05, hearRange: 3.4 })).toBe(true);
  });

  it("distributes wolf pack slots evenly around the target ring", () => {
    const a = computeFlankRingSlot({ centerX: 10, centerY: 10, slotIndex: 0, packSize: 3, ringRadius: 2.1, phaseRad: 0 });
    const b = computeFlankRingSlot({ centerX: 10, centerY: 10, slotIndex: 1, packSize: 3, ringRadius: 2.1, phaseRad: 0 });
    expect(Math.hypot(a.x - 10, a.y - 10)).toBeCloseTo(2.1, 4);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(3.5);
  });
});
