import { describe, expect, it } from "vitest";
import { floorAnnouncerLine } from "./floorAnnouncer.js";

describe("floorAnnouncerLine", () => {
  it("returns a distinct, non-empty line for each authored floor 1-5", () => {
    const lines = [1, 2, 3, 4, 5].map(floorAnnouncerLine);
    expect(new Set(lines).size).toBe(5);
    for (const line of lines) expect(line.length).toBeGreaterThan(0);
  });

  it("clamps below floor 1 to the floor-1 line", () => {
    expect(floorAnnouncerLine(0)).toBe(floorAnnouncerLine(1));
  });

  it("clamps past the authored table to the deepest line", () => {
    expect(floorAnnouncerLine(9)).toBe(floorAnnouncerLine(5));
  });
});
