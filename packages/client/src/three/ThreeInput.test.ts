import { describe, expect, it } from "vitest";
import { normalizedYaw, safeMouseDelta } from "./ThreeInput.js";

describe("ThreeInput mouse look safety", () => {
  it("rejects pointer-lock spikes and clamps unusually large valid deltas", () => {
    expect(safeMouseDelta(12)).toBe(12);
    expect(safeMouseDelta(300)).toBe(160);
    expect(safeMouseDelta(-300)).toBe(-160);
    expect(safeMouseDelta(900)).toBe(0);
  });

  it("keeps yaw bounded through repeated full turns", () => {
    expect(normalizedYaw(Math.PI * 9)).toBeCloseTo(Math.PI);
    expect(normalizedYaw(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5);
  });
});
