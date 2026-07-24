/** Verifies DOM touch visuals and Phaser hit routing share exact button geometry. */
import { describe, expect, it } from "vitest";
import { HtmlTouchHitRegions } from "./HtmlTouchHitRegions.js";

describe("HTML touch hit regions", () => {
  it("stays inert until touch input becomes active", () => {
    const regions = new HtmlTouchHitRegions();
    expect(regions.hitTest(956, 620, 1000, 720)).toBeNull();
  });

  it("routes all four action-button centers", () => {
    const regions = new HtmlTouchHitRegions();
    regions.setActive(true);
    expect(regions.hitTest(956, 620, 1000, 720)).toBe("touch:attack");
    expect(regions.hitTest(956, 575, 1000, 720)).toBe("touch:jump");
    expect(regions.hitTest(917, 575, 1000, 720)).toBe("touch:interact");
    expect(regions.hitTest(878, 575, 1000, 720)).toBe("touch:throw");
  });

  it("does not claim the world between controls", () => {
    const regions = new HtmlTouchHitRegions();
    regions.setActive(true);
    expect(regions.hitTest(500, 300, 1000, 720)).toBeNull();
  });
});
