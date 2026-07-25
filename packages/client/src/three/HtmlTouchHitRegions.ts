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

  hitTest(
    x: number,
    y: number,
    width: number,
    height: number,
  ): string | null {
    if (!this.active) return null;
    const hit = HTML_TOUCH_ACTIONS.find((region) =>
      insideCircle(x, y, width, height, region)
    );
    return hit ? `touch:${hit.action}` : null;
  }
}

const insideCircle = (
  x: number,
  y: number,
  width: number,
  height: number,
  region: HtmlTouchActionRegion,
): boolean => {
  const radius = region.size / 2;
  const center = touchActionCenter(region, width, height);
  return Math.hypot(x - center.x, y - center.y) <= radius;
};
