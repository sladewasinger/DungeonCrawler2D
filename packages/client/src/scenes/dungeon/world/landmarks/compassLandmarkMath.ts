import type { CompassLandmarkPosition } from "./compassLandmarkTypes.js";

export function nearestLandmark(input: {
  readonly positions: readonly CompassLandmarkPosition[];
  readonly x: number;
  readonly y: number;
}): CompassLandmarkPosition | null {
  const { positions, x, y } = input;
  return positions.reduce<CompassLandmarkPosition | null>((nearest, position) =>
    !nearest || landmarkDistance(x, y, position) < landmarkDistance(x, y, nearest)
      ? position
      : nearest, null);
}

export function landmarkDistance(
  x: number,
  y: number,
  target: CompassLandmarkPosition,
): number {
  return Math.hypot(target.x - x, target.y - y);
}
