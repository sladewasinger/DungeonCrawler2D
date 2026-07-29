import { describe, expect, it } from "vitest";
import { VIEW_DISTANCES } from "../view/viewDistance.js";
import {
  environmentProfile,
  geometryRemainsFogged,
} from "./threeEnvironment.js";

describe("Three renderer environment budgets", () => {
  it("hides every streaming boundary behind fog", () => {
    for (const distance of VIEW_DISTANCES) {
      expect(geometryRemainsFogged(distance)).toBe(true);
      expect(environmentProfile(distance).fogNear)
        .toBeLessThan(environmentProfile(distance).fogFar);
    }
  });

  it("caps expensive atmosphere as view distance grows", () => {
    expect(VIEW_DISTANCES.map((distance) =>
      environmentProfile(distance).maxSconceLights)).toEqual([4, 6, 8]);
    expect(VIEW_DISTANCES.map((distance) =>
      environmentProfile(distance).ambientMotes)).toEqual([32, 48, 64]);
  });
});
