/** Verifies DOM touch visuals and Phaser hit routing share exact button geometry. */
import { describe, expect, it } from "vitest";
import { HtmlTouchHitRegions } from "./HtmlTouchHitRegions.js";
import {
  HTML_TOUCH_ACTIONS,
  touchActionCenter,
} from "./HtmlTouchLayout.js";

const WIDTH = 1000;
const HEIGHT = 720;

describe("HTML touch hit regions", () => {
  it("stays inert until touch input becomes active", () => {
    const regions = new HtmlTouchHitRegions();
    const center = touchActionCenter(HTML_TOUCH_ACTIONS[0]!, WIDTH, HEIGHT);
    expect(regions.hitTest(center.x, center.y, WIDTH, HEIGHT)).toBeNull();
  });

  it("routes every action-button center", () => {
    const regions = new HtmlTouchHitRegions();
    regions.setActive(true);
    for (const region of HTML_TOUCH_ACTIONS) {
      const center = touchActionCenter(region, WIDTH, HEIGHT);
      expect(regions.hitTest(center.x, center.y, WIDTH, HEIGHT))
        .toBe(`touch:${region.action}`);
    }
  });

  it("does not claim the world between controls", () => {
    const regions = new HtmlTouchHitRegions();
    regions.setActive(true);
    expect(regions.hitTest(500, 300, WIDTH, HEIGHT)).toBeNull();
  });
});
