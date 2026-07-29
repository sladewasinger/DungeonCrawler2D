import { AOI_RADIUS } from "@dc2d/engine";

export interface AreaTileRetentionInput {
  readonly areaTiles: Map<string, string>;
  readonly areaTileLayers?: Map<string, readonly string[]>;
  readonly centerX: number;
  readonly centerY: number;
  readonly radius?: number;
}

export function pruneAreaTiles({
  areaTiles,
  areaTileLayers,
  centerX,
  centerY,
  radius = AOI_RADIUS,
}: AreaTileRetentionInput): void {
  const radiusSquared = radius * radius;
  for (const key of areaTiles.keys()) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) continue;
    areaTiles.delete(key);
    areaTileLayers?.delete(key);
  }
}
