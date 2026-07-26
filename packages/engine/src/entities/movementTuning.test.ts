import { describe, expect, it } from "vitest";
import { MOVE_SPEED, RUN_SPEED_MULTIPLIER } from "../core/constants.js";

describe("v0.3 movement tuning", () => {
  it("slows walking by 20% and sprinting by 30% from v0.2", () => {
    expect(MOVE_SPEED).toBeCloseTo(8 * 0.8);
    expect(MOVE_SPEED * RUN_SPEED_MULTIPLIER).toBeCloseTo(12 * 0.7);
  });
});
