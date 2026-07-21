import { describe, expect, it } from "vitest";
import { normalizeOrientation, rotateOrientation, VIEW_ORIENTATIONS, wrapDegrees } from "./viewOrientation.js";

describe("wrapDegrees", () => {
  it("passes in-range values through unchanged, including fractional ones", () => {
    expect(wrapDegrees(0)).toBe(0);
    expect(wrapDegrees(45)).toBe(45);
    expect(wrapDegrees(359.5)).toBeCloseTo(359.5);
  });

  it("wraps negative and over-360 fractional values into [0, 360)", () => {
    expect(wrapDegrees(-45)).toBe(315);
    expect(wrapDegrees(405)).toBe(45);
    expect(wrapDegrees(-0.5)).toBeCloseTo(359.5);
  });

  it("agrees with normalizeOrientation at every settled orientation", () => {
    for (const o of VIEW_ORIENTATIONS) expect(wrapDegrees(o)).toBe(normalizeOrientation(o));
  });
});

describe("normalizeOrientation", () => {
  it("passes the 4 settled values through unchanged", () => {
    for (const o of VIEW_ORIENTATIONS) expect(normalizeOrientation(o)).toBe(o);
  });

  it("wraps negative and over-360 values into range", () => {
    expect(normalizeOrientation(-90)).toBe(270);
    expect(normalizeOrientation(-360)).toBe(0);
    expect(normalizeOrientation(450)).toBe(90);
    expect(normalizeOrientation(720)).toBe(0);
  });
});

describe("rotateOrientation", () => {
  it("steps clockwise N -> E -> S -> W -> N", () => {
    expect(rotateOrientation(0, 1)).toBe(90);
    expect(rotateOrientation(90, 1)).toBe(180);
    expect(rotateOrientation(180, 1)).toBe(270);
    expect(rotateOrientation(270, 1)).toBe(0);
  });

  it("steps counter-clockwise the exact reverse", () => {
    expect(rotateOrientation(0, -1)).toBe(270);
    expect(rotateOrientation(270, -1)).toBe(180);
    expect(rotateOrientation(180, -1)).toBe(90);
    expect(rotateOrientation(90, -1)).toBe(0);
  });

  it("4 clockwise steps return to start, for every starting orientation", () => {
    for (const start of VIEW_ORIENTATIONS) {
      let o = start;
      for (let i = 0; i < 4; i++) o = rotateOrientation(o, 1);
      expect(o).toBe(start);
    }
  });
});
