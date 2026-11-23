import { describe, expect, it } from "vitest";
import { computeWeaponSwingLunge, computeWeaponSwingPose } from "./weaponSwingMotion.js";

describe("weaponSwingMotion", () => {
  it("lifts Pickaxe high overhead before slamming downward onto target tile", () => {
    const peakLift = computeWeaponSwingPose({ ax: 1, ay: 0, scale: 1, progress: 0.32, comboStep: 1, heldItem: "pickaxe" });
    const groundHit = computeWeaponSwingPose({ ax: 1, ay: 0, scale: 1, progress: 0.67, comboStep: 1, heldItem: "pickaxe" });
    expect(peakLift.y).toBeLessThan(-17);
    expect(groundHit.y).toBeGreaterThan(-4);
    expect(groundHit.x).toBeGreaterThan(peakLift.x);
  });

  it("extends Sword step-3 finisher lunge sharply forward along aim with amplified body lunge", () => {
    const recoil = computeWeaponSwingPose({ ax: 1, ay: 0, scale: 1, progress: 0.2, comboStep: 3, heldItem: "sword" });
    const peak = computeWeaponSwingPose({ ax: 1, ay: 0, scale: 1, progress: 0.57, comboStep: 3, heldItem: "sword" });
    expect(peak.x).toBeGreaterThan(9.5);
    expect(peak.x).toBeGreaterThan(recoil.x);

    const step1Lunge = computeWeaponSwingLunge({ ax: 1, ay: 0, swingProgress: 0.5, comboStep: 1, heldItem: "sword" });
    const finisherLunge = computeWeaponSwingLunge({ ax: 1, ay: 0, swingProgress: 0.57, comboStep: 3, heldItem: "sword" });
    expect(finisherLunge.x).toBeGreaterThan(step1Lunge.x);
  });

  it("sweeps Axe chop heavily with wide pullback and strong blade scale punch", () => {
    const mid = computeWeaponSwingPose({ ax: 1, ay: 0, scale: 1, progress: 0.5, comboStep: 1, heldItem: "axe" });
    expect(Math.hypot(mid.scaleX, mid.scaleY)).toBeGreaterThan(Math.SQRT2 * 1.15);
  });
});
