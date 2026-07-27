// Headless tests for splatter-direction derivation.
import { describe, expect, it } from "vitest";
import { splatterAngleWindow } from "./bloodDirection.js";

describe("splatterAngleWindow", () => {
  it("falls back to a full omnidirectional cone when no direction is given", () => {
    expect(splatterAngleWindow()).toEqual({ minDeg: 0, maxDeg: 360 });
  });

  it("falls back to omnidirectional for a zero vector", () => {
    expect(splatterAngleWindow(0, 0)).toEqual({ minDeg: 0, maxDeg: 360 });
  });

  it("centers a narrow cone on the given direction (pointing +x)", () => {
    const window = splatterAngleWindow(1, 0);
    expect(window.maxDeg - window.minDeg).toBe(70);
    expect((window.minDeg + window.maxDeg) / 2).toBeCloseTo(0, 5);
  });

  it("centers on the direction pointing straight down (+y)", () => {
    const window = splatterAngleWindow(0, 1);
    expect((window.minDeg + window.maxDeg) / 2).toBeCloseTo(90, 5);
  });
});
