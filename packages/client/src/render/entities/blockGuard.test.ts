import { describe, expect, it } from "vitest";
import {
  BLOCK_GUARD_RADIUS_TILES,
  BLOCK_GUARD_TILT_RAD,
  blockGuardTransform,
} from "./blockGuard.js";

describe("blockGuardTransform", () => {
  it("holds the blade across the chest and toward the threat", () => {
    const pose = blockGuardTransform(100, 80, 0, 48, 0);
    expect(pose.x).toBeCloseTo(100 + BLOCK_GUARD_RADIUS_TILES * 48);
    expect(pose.y).toBeCloseTo(80);
    expect(pose.rotation).toBeCloseTo(BLOCK_GUARD_TILT_RAD);
  });

  it("animates a bounded breathing guard without drifting its center", () => {
    const start = blockGuardTransform(100, 80, Math.PI / 2, 48, 0);
    const crest = blockGuardTransform(100, 80, Math.PI / 2, 48, 180);
    expect(crest.scale).toBeGreaterThan(start.scale);
    expect(crest.y).toBeGreaterThan(start.y);
    expect(crest.x).toBeCloseTo(start.x);
    expect(crest.scale).toBeLessThan(1.05);
  });
});
