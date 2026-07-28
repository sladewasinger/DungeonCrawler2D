// Headless tests for jump/land/turn edge-triggers and footstep cadence.
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  footstepDue,
  isMoving,
  isRunning,
  motionEvents,
  motionEventsInto,
  type MotionEvent,
  type MotionSample,
} from "./motionFx.js";

const grounded = (x: number, faceX = 1, groundHeight = 0): MotionSample => ({ x, y: 0, groundHeight, air: false, faceX });
const airborne = (x: number, faceX = 1, groundHeight = 0): MotionSample => ({ x, y: 0, groundHeight, air: true, faceX });

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

  it("reuses a caller-owned event buffer across long idle and edge sequences", () => {
    const events: MotionEvent[] = [];
    const identity = events;
    for (let frame = 0; frame < 1_000; frame++) {
      expect(motionEventsInto(grounded(frame), grounded(frame + 1), events))
        .toBe(identity);
      expect(events).toEqual([]);
    }

    expect(motionEventsInto(grounded(0, 1), airborne(0, -1), events))
      .toBe(identity);
    expect(events).toEqual(["jumped", "turned"]);
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

describe("isRunning", () => {
  it("is false with no previous sample", () => {
    expect(isRunning(undefined, grounded(6), 0.5)).toBe(false);
  });

  it("is false at walk speed, true at run speed", () => {
    expect(isRunning(grounded(0), grounded(MOVE_SPEED * 0.5), 0.5)).toBe(false);
    expect(isRunning(
      grounded(0),
      grounded(MOVE_SPEED * RUN_SPEED_MULTIPLIER * 0.5),
      0.5,
    )).toBe(true);
  });
});

describe("footstepDue", () => {
  it("is false unless grounded and moving", () => {
    expect(footstepDue({ previousMs: 0, nowMs: 1000, grounded: false, moving: true })).toBe(false);
    expect(footstepDue({ previousMs: 0, nowMs: 1000, grounded: true, moving: false })).toBe(false);
  });

  it("fires once per interval boundary crossed", () => {
    expect(footstepDue({ previousMs: 0, nowMs: 260, grounded: true, moving: true })).toBe(true);
    expect(footstepDue({ previousMs: 0, nowMs: 100, grounded: true, moving: true })).toBe(false);
  });
});
