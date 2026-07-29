import { describe, expect, it } from "vitest";
import { screenDirToWorld, screenMoveToWorld } from "./cameraRelative.js";

describe("screenMoveToWorld", () => {
  it("is the identity at orientation 0 (today's unrotated behavior)", () => {
    expect(screenMoveToWorld({ moveX: 1, moveY: -1, jump: true, run: false }, 0)).toEqual({
      moveX: 1,
      moveY: -1,
      jump: true,
      run: false,
    });
  });

  it("rotates screen-up (moveY=-1) into world-east at orientation 90 (east-up)", () => {
    // screenNorthWorldDirection(90) === "E" (directionRemap.ts) — world EAST renders at
    // screen-up at orientation 90, so pressing "forward" should walk the real body east.
    const result = screenMoveToWorld({ moveX: 0, moveY: -1, jump: false }, 90);
    expect(result.moveX).toBeCloseTo(1);
    expect(result.moveY).toBeCloseTo(0);
  });

  it("preserves jump/run flags untouched regardless of orientation", () => {
    const result = screenMoveToWorld({ moveX: 1, moveY: 0, jump: true, run: true }, 180);
    expect(result.jump).toBe(true);
    expect(result.run).toBe(true);
  });

  it("round-trips a diagonal intent's magnitude at every orientation", () => {
    for (const orientation of [0, 90, 180, 270] as const) {
      const result = screenMoveToWorld({ moveX: 0.6, moveY: -0.8, jump: false }, orientation);
      expect(Math.hypot(result.moveX, result.moveY)).toBeCloseTo(1);
    }
  });
});

describe("screenDirToWorld", () => {
  it("is the identity at orientation 0", () => {
    expect(screenDirToWorld({ x: 1, y: 0 }, 0)).toEqual({ x: 1, y: 0 });
  });

  it("matches screenMoveToWorld's rotation at a non-zero orientation", () => {
    expect(screenDirToWorld({ x: 0, y: -1 }, 90)).toEqual({ x: 1, y: 0 });
  });
});
