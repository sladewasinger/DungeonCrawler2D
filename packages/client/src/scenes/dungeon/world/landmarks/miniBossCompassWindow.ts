import { MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS } from "@dc2d/engine";

export interface MiniBossCompassWindowCenter {
  readonly cx: number;
  readonly cy: number;
}

export function maximumMiniBossSearchRadius(
  chunkX: number,
  chunkY: number,
  center: MiniBossCompassWindowCenter,
): number {
  const radius = MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS;
  return Math.max(
    Math.abs(chunkX - (center.cx - radius)),
    Math.abs(chunkX - (center.cx + radius)),
    Math.abs(chunkY - (center.cy - radius)),
    Math.abs(chunkY - (center.cy + radius)),
  );
}

export function chunkInsideMiniBossCompassWindow(
  chunk: MiniBossCompassWindowCenter,
  center: MiniBossCompassWindowCenter,
): boolean {
  const radius = MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS;
  return Math.abs(chunk.cx - center.cx) <= radius &&
    Math.abs(chunk.cy - center.cy) <= radius;
}
