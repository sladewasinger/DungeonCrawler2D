import { describe, expect, it } from "vitest";
import { sideStairBands } from "./sideStair.js";

describe("side stair profile", () => {
  it("covers the tile with narrow bands whose lifted surfaces form a diagonal", () => {
    const bands = sideStairBands();
    expect(bands).toHaveLength(5);
    expect(bands[0]).toEqual({ start: 0, end: 0.2, sample: 0.1 });
    expect(bands.at(-1)).toEqual({ start: 0.8, end: 1, sample: 0.9 });
    expect(bands.every((band, index) =>
      index === 0 || band.start === bands[index - 1]?.end)).toBe(true);
  });
});
