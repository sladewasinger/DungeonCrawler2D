import { describe, expect, it } from "vitest";
import { stacksVertically, treadRisers } from "./stairTread.js";

describe("stacksVertically", () => {
  it("stacks N/S climbs vertically and E/W climbs horizontally", () => {
    expect(stacksVertically(0)).toBe(true);
    expect(stacksVertically(2)).toBe(true);
    expect(stacksVertically(1)).toBe(false);
    expect(stacksVertically(3)).toBe(false);
  });
});

describe("treadRisers", () => {
  it("adds a bright high-edge nosing and five perspective-spaced treads", () => {
    const risers = treadRisers(0, 0.5);
    expect(risers).toHaveLength(5);
    expect(risers[0]).toEqual({ axisFrac: 0, brightness: 1, nosing: true });
  });

  it("north climb leaves the largest visual gap beside the high north edge", () => {
    const positions = treadRisers(0, 0.5).map(({ axisFrac }) => axisFrac);
    const gaps = positions.slice(1).map((position, index) =>
      position - (positions[index] ?? 0));
    expect(gaps[0]).toBeGreaterThan(gaps[1] ?? 0);
    expect(gaps[1]).toBeGreaterThan(gaps[2] ?? 0);
  });

  it("south climb mirrors the perspective spacing and high-edge nosing", () => {
    const north = treadRisers(0, 0.5).map(({ axisFrac }) => axisFrac);
    const south = treadRisers(2, 0.5).map(({ axisFrac }) => axisFrac);
    expect(south).toEqual(north.map((position) => 1 - position).reverse());
    expect(south.at(-1)).toBe(1);
  });

  it("interior risers brighten toward the high end", () => {
    const brightness = treadRisers(0, 0.5).slice(1).map((riser) => riser.brightness);
    expect(brightness[0]).toBeGreaterThan(brightness.at(-1) ?? 0);
  });
});
