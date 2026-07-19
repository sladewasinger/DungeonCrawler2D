// Headless tests for jump/land/turn edge-triggers and footstep cadence.
import { describe, expect, it } from "vitest";
import { footstepDue, isMoving, motionEvents, type MotionSample } from "./motionFx.js";

const grounded = (x: number, faceX = 1): MotionSample => ({ x, y: 0, air: false, faceX });
const airborne = (x: number, faceX = 1): MotionSample => ({ x, y: 0, air: true, faceX });

describe("motionEvents", () => {
  it("is empty with no previous sample", () => {
    expect(motionEvents(undefined, grounded(0))).toEqual([]);
  });

  it("fires jumped on the grounded->air edge", () => {
    expect(motionEvents(grounded(0), airborne(0))).toEqual(["jumped"]);
  });

  it("fires landed on the air->grounded edge", () => {
    expect(motionEvents(airborne(0), grounded(0))).toEqual(["landed"]);
  });

  it("fires turned when facing flips sign", () => {
    expect(motionEvents(grounded(0, 1), grounded(0, -1))).toEqual(["turned"]);
  });

  it("fires nothing when nothing changed", () => {
    expect(motionEvents(grounded(0, 1), grounded(1, 1))).toEqual([]);
  });
});

describe("isMoving", () => {
  it("is false with no previous sample or zero dt", () => {
    expect(isMoving(undefined, grounded(0), 0.1)).toBe(false);
    expect(isMoving(grounded(0), grounded(1), 0)).toBe(false);
  });

  it("is true once speed crosses the threshold", () => {
    expect(isMoving(grounded(0), grounded(1), 1)).toBe(true);
    expect(isMoving(grounded(0), grounded(0.01), 1)).toBe(false);
  });
});

describe("footstepDue", () => {
  it("is false unless grounded and moving", () => {
    expect(footstepDue(0, 1000, false, true)).toBe(false);
    expect(footstepDue(0, 1000, true, false)).toBe(false);
  });

  it("fires once per interval boundary crossed", () => {
    expect(footstepDue(0, 260, true, true)).toBe(true);
    expect(footstepDue(0, 100, true, true)).toBe(false);
  });
});
