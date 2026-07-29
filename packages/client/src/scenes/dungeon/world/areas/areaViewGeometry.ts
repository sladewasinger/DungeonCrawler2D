import type { AreaViewBounds } from "./areaViews.js";

export interface AreaCellPosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export function parseAreaCellPosition(key: string): AreaCellPosition {
  const [xs, ys] = key.split(",");
  return { key, x: Number(xs), y: Number(ys) };
}

export function areaCellVisible(input: {
  readonly screen: Readonly<{ x: number; y: number }>;
  readonly bounds: AreaViewBounds | undefined;
  readonly marginPx: number;
}): boolean {
  const { screen, bounds, marginPx } = input;
  if (!bounds) return true;
  return screen.x >= bounds.x - marginPx &&
    screen.x <= bounds.right + marginPx &&
    screen.y >= bounds.y - marginPx &&
    screen.y <= bounds.bottom + marginPx;
}
