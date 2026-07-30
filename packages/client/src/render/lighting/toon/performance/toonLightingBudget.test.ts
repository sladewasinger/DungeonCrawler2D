import { describe, expect, it } from "vitest";
import { TOON_LIGHTING_BUDGET } from "./toonLightingBudget.js";

describe("toon lighting budget", () => {
  it("uses one mask GameObject and no player floor-light cells", () => {
    expect(TOON_LIGHTING_BUDGET.maskGameObjects).toBe(1);
    expect(TOON_LIGHTING_BUDGET.playerGroundLightObjects).toBe(0);
    expect(TOON_LIGHTING_BUDGET.classicMaximumPlayerGroundLightObjects)
      .toBeGreaterThan(TOON_LIGHTING_BUDGET.maskGameObjects);
    expect(TOON_LIGHTING_BUDGET.lineOfSightChecksPerRebuild).toBe(4096);
    expect(TOON_LIGHTING_BUDGET.evaluatedCellsPerRebuild).toBe(4096);
  });
});
