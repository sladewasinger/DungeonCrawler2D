import { describe, expect, it } from "vitest";
import {
  advanceRotationTween,
  isPastCrossfadeMidpoint,
  isRotationTweenDone,
  ROTATION_TWEEN_MS,
  rotationTweenAngle,
  rotationTweenProgress,
  startRotationTween,
} from "./rotationTween.js";

describe("startRotationTween", () => {
  it("targets one 90-degree step clockwise for dir 1", () => {
    const tween = startRotationTween(0, 1);
    expect(tween.from).toBe(0);
    expect(tween.to).toBe(90);
    expect(tween.elapsedMs).toBe(0);
  });

  it("targets one 90-degree step counter-clockwise for dir -1, wrapping at 0", () => {
    const tween = startRotationTween(0, -1);
    expect(tween.to).toBe(270);
  });
});

describe("advanceRotationTween", () => {
  it("is not done partway through", () => {
    const tween = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS / 2);
    expect(isRotationTweenDone(tween)).toBe(false);
    expect(rotationTweenProgress(tween)).toBeCloseTo(0.5, 9);
  });

  it("is done at exactly the tween duration", () => {
    const tween = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS);
    expect(isRotationTweenDone(tween)).toBe(true);
    expect(rotationTweenProgress(tween)).toBe(1);
  });

  it("clamps — never overshoots past the duration even with a huge dt", () => {
    const tween = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS * 10);
    expect(tween.elapsedMs).toBe(ROTATION_TWEEN_MS);
    expect(rotationTweenProgress(tween)).toBe(1);
  });

  it("accumulates across multiple small steps", () => {
    let tween = startRotationTween(0, 1);
    const step = ROTATION_TWEEN_MS / 5;
    for (let i = 0; i < 5; i++) tween = advanceRotationTween(tween, step);
    expect(isRotationTweenDone(tween)).toBe(true);
  });
});

describe("rotationTweenAngle", () => {
  it("starts at `from` and ends at `to`", () => {
    const start = startRotationTween(90, 1);
    expect(rotationTweenAngle(start)).toBe(90);
    const done = advanceRotationTween(start, ROTATION_TWEEN_MS);
    expect(rotationTweenAngle(done)).toBe(180);
  });

  it("is the midpoint (45 degrees past `from`) at half duration", () => {
    const half = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS / 2);
    expect(rotationTweenAngle(half)).toBeCloseTo(45, 9);
  });

  it("moves the opposite direction for a counter-clockwise step", () => {
    const half = advanceRotationTween(startRotationTween(0, -1), ROTATION_TWEEN_MS / 2);
    expect(rotationTweenAngle(half)).toBeCloseTo(315, 9); // -45 normalized
  });
});

describe("isPastCrossfadeMidpoint", () => {
  it("is false before 45 degrees, true at and after", () => {
    const before = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS * 0.49);
    const at = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS * 0.5);
    const after = advanceRotationTween(startRotationTween(0, 1), ROTATION_TWEEN_MS * 0.51);
    expect(isPastCrossfadeMidpoint(before)).toBe(false);
    expect(isPastCrossfadeMidpoint(at)).toBe(true);
    expect(isPastCrossfadeMidpoint(after)).toBe(true);
  });
});
