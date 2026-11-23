/** Pure spatial audio probe helpers and event-to-gore builders for WorldScene. */
import {
  GroundKind, WorldChunkCache,
  type PlayerSnapshot, type PointLightSpec, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";

export interface SceneAudioDistances {
  readonly campfireDist: number;
  readonly waterDist: number;
}

const WATER_PROBE_RING: readonly (readonly [number, number])[] = [
  [-2, 0], [2, 0], [0, -2], [0, 2], [-4, -4], [0, -4], [4, -4],
  [-4, 0], [4, 0], [-4, 4], [0, 4], [4, 4], [-6, 0], [6, 0], [0, -6], [0, 6],
];

export function nearestCampfireDist(campfires: readonly PointLightSpec[], local: PlayerSnapshot | undefined): number {
  if (!local || campfires.length === 0) return 99;
  let best = 99;
  for (const fire of campfires) {
    const d = Math.hypot(fire.x - local.x, fire.y - local.y);
    if (d < best) best = d;
  }
  return best;
}

export function nearestWaterDist(cache: WorldChunkCache, local: PlayerSnapshot | undefined): number {
  if (!local) return 99;
  if (local.inWater) return 0;
  const cx = Math.floor(local.x);
  const cy = Math.floor(local.y);
  let best = 99;
  for (const [dx, dy] of WATER_PROBE_RING) {
    const g = cache.tileAt(cx + dx, cy + dy).ground;
    if (g === GroundKind.ShallowWater || g === GroundKind.DeepWater) {
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}

export function resolveEventElev(
  id: string | undefined,
  entities: readonly WorldEntitySnapshot[] | undefined,
  local: PlayerSnapshot | undefined,
): number {
  const match = id ? entities?.find((e) => e.id === id) : undefined;
  return match?.elevation ?? local?.elevation ?? 0;
}

export function buildGoreSpawn(ev: WorldEvent, elevation: number) {
  return {
    x: ev.x, y: ev.y, elevation,
    dirX: ev.dirX ?? 0, dirY: ev.dirY ?? 1,
    style: ev.goreStyle!, substance: ev.substance!,
  };
}
