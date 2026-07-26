import { describe, expect, it } from "vitest";
import { breathPuffPose } from "./outOfBreathFx.js";

describe("breathPuffPose", () => {
  it("drifts away from the remembered sprite-facing side", () => {
    expect(breathPuffPose(225, 0, 1).x).toBeGreaterThan(0);
    expect(breathPuffPose(225, 0, -1).x).toBeLessThan(0);
  });

  it("stays bounded while fading in and out", () => {
    for (let now = 0; now <= 1800; now += 50) {
      const pose = breathPuffPose(now, 1, 1);
      expect(pose.alpha).toBeGreaterThanOrEqual(0);
      expect(pose.alpha).toBeLessThanOrEqual(0.72);
      expect(pose.radius).toBeGreaterThanOrEqual(2.5);
      expect(pose.radius).toBeLessThanOrEqual(6);
    }
  });
});
