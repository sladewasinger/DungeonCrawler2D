import { describe, expect, it } from "vitest";
import { stairTreadAxis } from "../view/directionRemap.js";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { stacksVertically } from "./stairTread.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";

const WORLD_COMPASS = ["N", "E", "S", "W"] as const;

describe("screenClimbDirIndex", () => {
  it("is the identity at orientation 0 (today's unrotated view)", () => {
    for (let d = 0; d < 4; d++) expect(screenClimbDirIndex(d, 0)).toBe(d);
  });

  it("agrees with stairTreadAxis's own vertical/horizontal call at every orientation and world climb direction", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (let worldDirection = 0; worldDirection < 4; worldDirection++) {
        const screenIndex = screenClimbDirIndex(worldDirection, orientation);
        const axis = stairTreadAxis(WORLD_COMPASS[worldDirection]!, orientation);
        expect(stacksVertically(screenIndex)).toBe(axis === "horizontal");
      }
    }
  });

  it("a world north/south climb (vertical stack) becomes an east/west (horizontal stack) screen direction at 90", () => {
    expect(stacksVertically(screenClimbDirIndex(0, 90))).toBe(false); // world N
    expect(stacksVertically(screenClimbDirIndex(2, 90))).toBe(false); // world S
  });
});
