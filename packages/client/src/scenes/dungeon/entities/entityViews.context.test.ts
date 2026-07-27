import { describe, expect, it } from "vitest";
import { buildRenderContext } from "./entityViews.js";

describe("buildRenderContext", () => {
  it("rewrites a caller-owned frame context", () => {
    const world = { groundAt: () => 0 } as never;
    const context = buildRenderContext({ world, nowMs: 1, dtSeconds: 0.016, selfX: 2, selfY: 3, partyIds: new Set() });
    expect(buildRenderContext({ world, nowMs: 2, dtSeconds: 0.02, selfX: 4, selfY: 5, partyIds: new Set(["p"]), target: context })).toBe(context);
    expect(context).toMatchObject({ nowMs: 2, dtSeconds: 0.02, selfX: 4, selfY: 5 });
  });
});
