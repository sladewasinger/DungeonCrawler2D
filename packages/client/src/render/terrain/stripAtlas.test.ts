import { describe, expect, it } from "vitest";
import { planStripAtlas } from "./stripAtlas.js";

describe("planStripAtlas", () => {
  it("packs native-resolution strips with a one-texel pad", () => {
    const plan = planStripAtlas([16, 32, 16], 288, 1);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 0, bandY: 17 },
      { page: 0, bandY: 50 },
    ]);
    expect(plan.pageHeights).toEqual([66]);
  });

  it("starts a new page when the next strip would cross the cap", () => {
    const plan = planStripAtlas([16, 16, 16], 40, 1);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 0, bandY: 17 },
      { page: 1, bandY: 0 },
    ]);
    expect(plan.pageHeights).toEqual([34, 16]);
  });

  it("gives an oversized strip its own full-height page rather than splitting it", () => {
    const plan = planStripAtlas([16, 300], 100, 1);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 1, bandY: 0 },
    ]);
    expect(plan.pageHeights).toEqual([16, 300]);
  });

  it("rounds odd page heights up to even for DynamicTexture", () => {
    const plan = planStripAtlas([17], 288, 1);
    expect(plan.pageHeights).toEqual([18]);
    expect(plan.strips).toEqual([{ page: 0, bandY: 0 }]);
  });

  it("returns an empty plan for no strips", () => {
    const plan = planStripAtlas([]);
    expect(plan.pageHeights).toEqual([]);
    expect(plan.strips).toEqual([]);
  });
});
