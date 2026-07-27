import { describe, expect, it } from "vitest";
import { FirstPersonCameraMotion } from "./FirstPersonCameraMotion.js";

const state = (
  x: number,
  grounded = true,
) => ({ x, y: 0, z: 0, verticalVelocity: 0, grounded });

describe("FirstPersonCameraMotion", () => {
  it("adds only a restrained grounded footfall offset", () => {
    const motion = new FirstPersonCameraMotion();
    motion.update({ state: state(0), elapsed: 0.016, reducedMotion: false });
    const offset = motion.update({ state: state(0.1), elapsed: 0.016, reducedMotion: false });
    expect(Math.abs(offset)).toBeGreaterThan(0);
    expect(Math.abs(offset)).toBeLessThan(0.02);
  });

  it("adds a short landing dip without altering body state", () => {
    const motion = new FirstPersonCameraMotion();
    motion.update({ state: state(0, false), elapsed: 0.016, reducedMotion: false });
    expect(motion.update({ state: state(0, true), elapsed: 0.016, reducedMotion: false })).toBeLessThan(0);
  });

  it("disables procedural motion under reduced-motion presentation", () => {
    const motion = new FirstPersonCameraMotion();
    motion.update({ state: state(0), elapsed: 0.016, reducedMotion: false });
    expect(motion.update({ state: state(0.2), elapsed: 0.016, reducedMotion: true })).toBe(0);
  });
});
