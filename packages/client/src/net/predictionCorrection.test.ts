/** Verifies that reconciliation corrections accumulate exactly once between render frames. */
import { describe, expect, it } from "vitest";
import { PredictionCorrection } from "./predictionCorrection.js";

describe("PredictionCorrection", () => {
  it("accumulates multiple snapshot corrections before rendering", () => {
    const correction = new PredictionCorrection();
    correction.record({ x: 5, y: 4, z: 1 }, { x: 4.75, y: 4.5, z: 1 });
    correction.record({ x: 5, y: 5, z: 1 }, { x: 4.9, y: 4.8, z: 0.75 });

    const accumulated = correction.consume();
    expect(accumulated.x).toBeCloseTo(-0.35);
    expect(accumulated.y).toBeCloseTo(0.3);
    expect(accumulated.z).toBeCloseTo(-0.25);
    expect(correction.consume()).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("drops pending correction state when reset", () => {
    const correction = new PredictionCorrection();
    correction.record({ x: 2, y: 2, z: 0 }, { x: 1, y: 1, z: 0 });

    correction.reset();

    expect(correction.consume()).toEqual({ x: 0, y: 0, z: 0 });
  });
});
