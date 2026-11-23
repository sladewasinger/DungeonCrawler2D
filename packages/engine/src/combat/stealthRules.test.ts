import { describe, expect, it } from "vitest";
import { WorldChunkCache } from "../world/collision.js";
import { PropKind, type ChunkProp } from "../world/types.js";
import { isBackstabAngle, sampleStealthExposure } from "./stealthRules.js";

class BushCoverCache extends WorldChunkCache {
  override propsNear(): readonly ChunkProp[] {
    return [{ id: "b1", kind: PropKind.Bush, x: 5.2, y: 5.1, variant: 0, elevation: 0, radius: 0.4, blocksMovement: false }];
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
});