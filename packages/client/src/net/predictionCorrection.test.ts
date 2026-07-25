/** Verifies small divergence is ignored, meaningful error eases, and invalid states snap. */
import { describe, expect, it } from "vitest";
import {
  CORRECTION_HARD_THRESHOLD,
  PredictionCorrection,
} from "./predictionCorrection.js";

describe("PredictionCorrection", () => {
  it("preserves the pre-reconcile visual pose before decaying toward truth", () => {
    const correction = new PredictionCorrection();
    correction.record({ x: 5, y: 4, z: 1 }, { x: 4.75, y: 4.5, z: 1 });

    expect(correction.advance(16)).toEqual({ x: 0.25, y: -0.5, z: 0 });
    expect(Math.abs(correction.advance(1000).x)).toBeLessThan(0.25);
  });

  it("ignores sub-pixel noise instead of perpetually correcting it", () => {
    const correction = new PredictionCorrection();
    correction.record({ x: 1, y: 1, z: 0 }, { x: 1.001, y: 1, z: 0 });

    expect(correction.advance(16)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("clears correction only on collision-blocked movement axes", () => {
    const correction = new PredictionCorrection();
    correction.record({ x: 1.5, y: 2.5, z: 0 }, { x: 1, y: 2, z: 0 });

    expect(correction.advance(16, { x: true })).toEqual({ x: 0, y: 0.5, z: 0 });
    expect(correction.advance(0).x).toBe(0);
    expect(correction.advance(0).y).toBeGreaterThan(0);
  });

  it("advances into one stable output record without allocating axis options", () => {
    const correction = new PredictionCorrection();
    const output = { x: 0, y: 0, z: 0 };
    correction.record({ x: 1.5, y: 2.5, z: 0.25 }, { x: 1, y: 2, z: 0 });

    for (let frame = 0; frame < 1_000; frame++) {
      expect(correction.advanceInto(0, true, false, output)).toBe(output);
    }

    expect(output).toEqual({ x: 0, y: 0.5, z: 0.25 });
  });

  it("hard-snaps teleports and invalid divergence without carrying an offset", () => {
    const correction = new PredictionCorrection();
    correction.record(
      { x: CORRECTION_HARD_THRESHOLD + 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );

    expect(correction.consumeHardSnap()).toBe(true);
    expect(correction.consumeHardSnap()).toBe(false);
    expect(correction.advance(16)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it.each([
    { x: Number.NaN, y: 0, z: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
  ])("hard-snaps invalid coordinates exactly once and clears diagnostics", (invalid) => {
    const correction = new PredictionCorrection();
    correction.record({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    correction.record(invalid, { x: 0, y: 0, z: 0 });

    expect(correction.consumeHardSnap()).toBe(true);
    expect(correction.consumeHardSnap()).toBe(false);
    expect(correction.advance(16)).toEqual({ x: 0, y: 0, z: 0 });
    expect(correction.lastError).toBe(0);
  });
});
