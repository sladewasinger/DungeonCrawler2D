import { describe, expect, it } from "vitest";
import { threeGroundedDepth } from "./threeGroundedDepth.js";

describe("threeGroundedDepth", () => {
  it.each([0, 0.5, 1])(
    "places a death-loot chest above z=%s ground",
    (groundHeight) => {
      expect(threeGroundedDepth(groundHeight, 0.24)).toEqual({
        worldY: groundHeight + 0.24,
        depthTest: true,
        depthWrite: true,
      });
    },
  );

  it("keeps terrain depth testing enabled at stair and chasm elevations", () => {
    for (const height of [-1, -0.5, 0.5]) {
      const contract = threeGroundedDepth(height, 0.24);
      expect(contract.worldY).toBe(height + 0.24);
      expect(contract.depthTest).toBe(true);
      expect(contract.depthWrite).toBe(true);
    }
  });
});
