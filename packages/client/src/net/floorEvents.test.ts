import { describe, expect, it } from "vitest";
import { floorChangeEvents } from "./floorEvents.js";

describe("floorChangeEvents", () => {
  it("emits floorEntered when the floor rises (descend)", () => {
    expect(floorChangeEvents(1, 2)).toEqual([{ t: "floorEntered", floor: 2 }]);
  });

  it("emits floorEntered when the floor falls (ascend/respawn)", () => {
    expect(floorChangeEvents(3, 1)).toEqual([{ t: "floorEntered", floor: 1 }]);
  });

  it("emits nothing when the floor is unchanged", () => {
    expect(floorChangeEvents(2, 2)).toEqual([]);
  });
});
