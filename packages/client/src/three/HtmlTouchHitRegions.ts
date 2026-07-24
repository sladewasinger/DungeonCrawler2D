/** Matches the DOM touch overlay's button geometry for Phaser pointer routing. */

export type HtmlTouchAction = "attack" | "jump" | "interact" | "throw";

interface CircleRegion {
  action: HtmlTouchAction;
  right: number;
  bottom: number;
  size: number;
}

const REGIONS: readonly CircleRegion[] = [
  { action: "attack", right: 24, bottom: 80, size: 40 },
  { action: "jump", right: 29, bottom: 130, size: 30 },
  { action: "interact", right: 68, bottom: 130, size: 30 },
  { action: "throw", right: 107, bottom: 130, size: 30 },
];

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
    const hit = REGIONS.find((region) =>
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
  region: CircleRegion,
): boolean => {
  const radius = region.size / 2;
  const centerX = width - region.right - radius;
  const centerY = height - region.bottom - radius;
  return Math.hypot(x - centerX, y - centerY) <= radius;
};
