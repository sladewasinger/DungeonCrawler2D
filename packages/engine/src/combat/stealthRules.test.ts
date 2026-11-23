import { describe, expect, it } from "vitest";
import { WorldChunkCache } from "../world/collision.js";
import { PropKind, type ChunkProp } from "../world/types.js";
import { canPerceiveTarget } from "./aiSensing.js";
import { isBackstabAngle, sampleStealthExposure } from "./stealthRules.js";

class BushCoverCache extends WorldChunkCache {
  override propsNear(): readonly ChunkProp[] {
    return [{ id: "b1", kind: PropKind.Bush, x: 5.2, y: 5.1, variant: 0, elevation: 0, radius: 0.4, blocksMovement: false }];
  }
}

class CanopyAndPalisadeCache extends WorldChunkCache {
  override propsNear(): readonly ChunkProp[] {
    return [
      { id: "tree1", kind: PropKind.PineTree, x: 5.2, y: 5.1, variant: 0, elevation: 0, radius: 0.38, blocksMovement: true },
      { id: "pal1", kind: PropKind.Palisade, x: 8, y: 5, variant: 0, elevation: 0, radius: 0.48, blocksMovement: true },
    ];
  }
}

describe("stealthRules", () => {
  it("lowers player visibility when crouching in cover at night and spikes it with a lit torch", () => {
    const cache = new BushCoverCache(1337);
    const sneaking = sampleStealthExposure({
      cache, x: 5, y: 5, dayPhase: 0.05, torchLit: false, crouching: true, moving: false, sprinting: false,
    });
    const lit = sampleStealthExposure({
      cache, x: 5, y: 5, dayPhase: 0.05, torchLit: true, crouching: false, moving: true, sprinting: true,
    });
    expect(sneaking.inCover).toBe(true);
    expect(sneaking.visibility).toBeLessThan(0.2);
    expect(lit.visibility).toBeGreaterThan(0.75);
    expect(lit.noiseRadius).toBeGreaterThan(sneaking.noiseRadius * 4);
  });

  it("identifies true backstab attack angles behind the target facing vector", () => {
    expect(isBackstabAngle({ attacker: { x: 0, y: 0 }, target: { x: 2, y: 0 }, targetFacing: { x: 1, y: 0 } })).toBe(true);
    expect(isBackstabAngle({ attacker: { x: 4, y: 0 }, target: { x: 2, y: 0 }, targetFacing: { x: 1, y: 0 } })).toBe(false);
  });

  it("applies tree canopy shade, amplifies water footsteps, and preserves close sight near doorways", () => {
    const cache = new CanopyAndPalisadeCache(1337);
    const open = sampleStealthExposure({
      cache, x: 15, y: 15, dayPhase: 0.5, torchLit: false, crouching: false, moving: false, sprinting: false,
    });
    const underTree = sampleStealthExposure({
      cache, x: 5.3, y: 5.2, dayPhase: 0.5, torchLit: false, crouching: false, moving: false, sprinting: false,
    });
    const dryWalk = sampleStealthExposure({
      cache, x: 15, y: 15, dayPhase: 0.5, torchLit: false, crouching: false, moving: true, sprinting: false, inWater: false,
    });
    const wetWalk = sampleStealthExposure({
      cache, x: 15, y: 15, dayPhase: 0.5, torchLit: false, crouching: false, moving: true, sprinting: false, inWater: true,
    });
    expect(underTree.visibility).toBeLessThan(open.visibility);
    expect(wetWalk.noiseRadius).toBeGreaterThan(dryWalk.noiseRadius);

    const seesPastPost = canPerceiveTarget({
      cache,
      observer: { x: 7.4, y: 4.5, elevation: 0, facingX: 1, facingY: 0 },
      target: { x: 9.6, y: 4.7, elevation: 0, moving: false, visibility: 0.85 },
      visionRange: 8.8, halfConeRad: 1.2, hearRange: 3.6,
    });
    expect(seesPastPost).toBe(true);
  });
});