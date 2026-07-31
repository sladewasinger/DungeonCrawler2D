import { describe, expect, it, vi } from "vitest";
import { pruneGameplayDebugLabels } from "./gameplayDebugLabels.js";

describe("gameplay debug labels", () => {
  it("destroys labels for entities absent from the current diagnostic snapshot", () => {
    const retained = { destroy: vi.fn() };
    const stale = { destroy: vi.fn() };
    const labels = new Map([
      ["nearby", retained],
      ["gone", stale],
    ]);

    pruneGameplayDebugLabels(labels, new Set(["nearby"]));

    expect(labels).toEqual(new Map([["nearby", retained]]));
    expect(retained.destroy).not.toHaveBeenCalled();
    expect(stale.destroy).toHaveBeenCalledOnce();
  });
});
