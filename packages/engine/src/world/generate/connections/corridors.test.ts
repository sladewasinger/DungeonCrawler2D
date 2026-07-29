import { describe, expect, it } from "vitest";
import { corridorWidth } from "./corridors.js";

const A = { x0: 2, y0: 3, x1: 8, y1: 10 };
const B = { x0: 20, y0: 16, x1: 28, y1: 24 };

describe("corridor width", () => {
  it("keeps deterministic width variation within the two-to-three tile grammar", () => {
    const widths = new Set(Array.from({ length: 256 }, (_, seed) => corridorWidth(seed, A, B)));
    expect(widths).toEqual(new Set([2, 3]));
  });
});
