import { describe, expect, it } from "vitest";
import { AREA_FLOOR_FIRE_FLAMES } from "../presentation/areaVisualStyle.js";
import {
  createFloorFireFlameStates,
  updateFloorFireFlameState,
} from "./floorFireFlameMotion.js";

describe("layered floor fire", () => {
  it("uses one low, squashed anchor bed beneath the flame particles", () => {
    const states = createFloorFireFlameStates();
    expect(states).toHaveLength(1);
    expect(AREA_FLOOR_FIRE_FLAMES.layers[0]).toMatchObject({
      horizontalScale: 1.5,
      verticalScale: 0.7,
    });
  });

  it("uses per-anchor phases so connected flames do not move in lockstep", () => {
    const first = createFloorFireFlameStates()[0]!;
    const second = createFloorFireFlameStates()[0]!;
    updateFloorFireFlameState({
      state: first,
      index: 0,
      nowMs: 240,
      phaseOffset: 0.4,
    });
    updateFloorFireFlameState({
      state: second,
      index: 0,
      nowMs: 240,
      phaseOffset: 2.2,
    });
    expect(second).not.toEqual(first);
  });
});
