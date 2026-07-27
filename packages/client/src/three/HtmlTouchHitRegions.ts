/** Matches the DOM touch overlay's button geometry for Phaser pointer routing. */
import {
  HTML_TOUCH_ACTIONS,
  touchActionCenter,
  type HtmlTouchActionRegion,
} from "./HtmlTouchLayout.js";

export class HtmlTouchHitRegions {
  private active = false;

  setActive(active: boolean): void {
    this.active = active;
  }

  hitTest(input: TouchHitTest): string | null {
    if (!this.active) return null;
    const hit = HTML_TOUCH_ACTIONS.find((region) =>
      insideCircle(input, region)
    );
    return hit ? `touch:${hit.action}` : null;
  }
}

export interface TouchHitTest {
  x: number;
  y: number;
  width: number;
  height: number;
}

const insideCircle = (input: TouchHitTest, region: HtmlTouchActionRegion): boolean => {
  const radius = region.size / 2;
  const center = touchActionCenter(region, input.width, input.height);
  return Math.hypot(input.x - center.x, input.y - center.y) <= radius;
};
