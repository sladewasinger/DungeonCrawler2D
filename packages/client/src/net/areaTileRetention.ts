import { AOI_RADIUS } from "@dc2d/engine";

export function pruneAreaTiles(
  areaTiles: Map<string, string>,
  centerX: number,
  centerY: number,
  radius: number = AOI_RADIUS,
): void {
  const radiusSquared = radius * radius;
  for (const key of areaTiles.keys()) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) continue;
    areaTiles.delete(key);
  }
}
