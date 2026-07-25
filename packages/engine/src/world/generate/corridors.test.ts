import { describe, expect, it } from "vitest";
import { CORRIDOR_WIDTH_MIN, corridorWidth } from "./corridors.js";

const A = { x0: 2, y0: 3, x1: 8, y1: 10 };
const B = { x0: 20, y0: 16, x1: 28, y1: 24 };

describe("corridor width", () => {
  it("never authors the ambiguous one-tile default artery", () => {
    for (let seed = 0; seed < 10_000; seed++) {
      expect(corridorWidth(seed, A, B)).toBeGreaterThanOrEqual(CORRIDOR_WIDTH_MIN);
    }
  });

  it("keeps deterministic width variation within the two-to-three tile grammar", () => {
    const widths = new Set(Array.from({ length: 256 }, (_, seed) => corridorWidth(seed, A, B)));
    expect(widths).toEqual(new Set([2, 3]));
  });
});
