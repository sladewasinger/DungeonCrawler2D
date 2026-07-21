import { describe, expect, it } from "vitest";
import { planStripAtlas } from "./stripAtlas.js";

describe("planStripAtlas", () => {
  it("packs strips top-to-bottom with the pad between bands, page sized to content", () => {
    // Hand-derived with pad=2: bands at 0, 48+2=50, 50+96+2=148; page height
    // = 148 + 48 = 196 (even already).
    const plan = planStripAtlas([48, 96, 48], 2048, 2);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 0, bandY: 50 },
      { page: 0, bandY: 148 },
    ]);
    expect(plan.pageHeights).toEqual([196]);
  });

  it("starts a new page when the next strip would cross the cap", () => {
    // Cap 100, pad 2: strip0 [0,48), cursor 50; strip1 needs 50+48=98 <= 100 → fits,
    // cursor 100; strip2 needs 100+48=148 > 100 → page 1 at 0.
    const plan = planStripAtlas([48, 48, 48], 100, 2);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 0, bandY: 50 },
      { page: 1, bandY: 0 },
    ]);
    expect(plan.pageHeights).toEqual([98, 48]);
  });

  it("gives an oversized strip its own full-height page rather than splitting it", () => {
    const plan = planStripAtlas([48, 900], 100, 2);
    expect(plan.strips).toEqual([
      { page: 0, bandY: 0 },
      { page: 1, bandY: 0 },
    ]);
    expect(plan.pageHeights).toEqual([48, 900]);
  });

  it("rounds odd page heights up to even (DynamicTexture forceEven)", () => {
    const plan = planStripAtlas([49], 2048, 2);
    expect(plan.pageHeights).toEqual([50]);
    expect(plan.strips).toEqual([{ page: 0, bandY: 0 }]);
  });

  it("returns an empty plan for no strips", () => {
    const plan = planStripAtlas([]);
    expect(plan.pageHeights).toEqual([]);
    expect(plan.strips).toEqual([]);
  });
});
