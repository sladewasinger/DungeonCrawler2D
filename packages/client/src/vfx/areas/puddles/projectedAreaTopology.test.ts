import { describe, expect, it } from "vitest";
import { AREA_NEIGHBOR } from "./areaTileTopology.js";
import { projectedNeighborMask } from "./projectedAreaTopology.js";

describe("projected area topology", () => {
  it("rotates world adjacency into screen-space adjacency", () => {
    const mask = projectedNeighborMask({
      x: 0,
      y: 0,
      neighborMask: AREA_NEIGHBOR.east | AREA_NEIGHBOR.south,
      project: (x, y) => ({ x: -y, y: x }),
    });
    expect(mask).toBe(AREA_NEIGHBOR.south | AREA_NEIGHBOR.west);
  });
});
