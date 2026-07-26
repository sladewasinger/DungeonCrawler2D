import { describe, expect, it } from "vitest";
import { roomFloorLabelPosition } from "./roomPresentation.js";

describe("room floor label placement", () => {
  it("moves the personal-room title clear of its projected south wall", () => {
    expect(roomFloorLabelPosition("personal", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 14.5 });
  });

  it("keeps larger room titles at their geometric centers", () => {
    expect(roomFloorLabelPosition("party", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 16 });
    expect(roomFloorLabelPosition("safe", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 16 });
  });
});
