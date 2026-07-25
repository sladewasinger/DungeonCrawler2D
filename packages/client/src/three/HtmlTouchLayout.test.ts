import { describe, expect, it } from "vitest";
import {
  HTML_TOUCH_ACTIONS,
  HTML_TOUCH_BAG,
  HTML_TOUCH_STICK,
  touchActionBounds,
  touchActionCenter,
} from "./HtmlTouchLayout.js";

const VIEWPORTS = [
  { name: "compact phone", width: 640, height: 320 },
  { name: "standard phone", width: 844, height: 390 },
  { name: "large phone", width: 932, height: 430 },
  { name: "tablet", width: 1180, height: 820 },
] as const;

describe("HTML touch control layout", () => {
  it("provides every required 2D gameplay action", () => {
    expect(HTML_TOUCH_ACTIONS.map((region) => region.action)).toEqual([
      "attack",
      "block",
      "jump",
      "interact",
      "throw",
    ]);
  });

  it("uses at least 44px touch targets", () => {
    for (const region of HTML_TOUCH_ACTIONS) {
      expect(region.size).toBeGreaterThanOrEqual(44);
    }
    expect(HTML_TOUCH_BAG.width).toBeGreaterThanOrEqual(44);
    expect(HTML_TOUCH_BAG.height).toBeGreaterThanOrEqual(36);
  });

  for (const viewport of VIEWPORTS) {
    it(`keeps controls on-screen and separated on a ${viewport.name}`, () => {
      const bounds = HTML_TOUCH_ACTIONS.map((region) =>
        touchActionBounds(region, viewport.width, viewport.height)
      );
      for (const box of bounds) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      }
      for (let left = 0; left < HTML_TOUCH_ACTIONS.length; left += 1) {
        for (let right = left + 1; right < HTML_TOUCH_ACTIONS.length; right += 1) {
          const first = HTML_TOUCH_ACTIONS[left]!;
          const second = HTML_TOUCH_ACTIONS[right]!;
          const firstCenter = touchActionCenter(first, viewport.width, viewport.height);
          const secondCenter = touchActionCenter(second, viewport.width, viewport.height);
          expect(Math.hypot(
            firstCenter.x - secondCenter.x,
            firstCenter.y - secondCenter.y,
          )).toBeGreaterThanOrEqual((first.size + second.size) / 2);
        }
      }
      const actionLeft = Math.min(...bounds.map((box) => box.left));
      const stickRight = HTML_TOUCH_STICK.left + HTML_TOUCH_STICK.width;
      expect(actionLeft).toBeGreaterThan(stickRight);
      const bagLeft = (viewport.width - HTML_TOUCH_BAG.width) / 2;
      const bagRight = bagLeft + HTML_TOUCH_BAG.width;
      expect(bagLeft).toBeGreaterThan(stickRight);
      expect(bagRight).toBeLessThan(actionLeft);
    });
  }
});
