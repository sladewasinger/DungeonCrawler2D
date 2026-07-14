import { describe, expect, it } from "vitest";
import { entityDepth, terrainOccluderDepth } from "./depth";

describe("world draw ordering", () => {
  it("puts lower ground behind a platform face, its top above it, and foreground actors in front", () => {
    const face = terrainOccluderDepth(10);
    expect(entityDepth(9.5, 0)).toBeLessThan(face);
    expect(entityDepth(10.5, 2)).toBeGreaterThan(face);
    expect(entityDepth(11.5, 0)).toBeGreaterThan(face);
  });

  it("is monotone over the unbounded world", () => {
    expect(entityDepth(-100_000, 0)).toBeLessThan(entityDepth(0, 0));
    expect(entityDepth(0, 0)).toBeLessThan(entityDepth(100_000, 0));
  });
});

