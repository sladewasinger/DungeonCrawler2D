import type { EnemySlot, SimState } from "../../state/state.js";
import { elementalSegmentIsReachable } from "./flameBoundary.js";

export function oilSourceFor(
  sim: SimState,
  ownerId: string | undefined,
): EnemySlot | undefined {
  return sim.enemies.get(ownerId ?? "");
}

export function oilCellIsReachable(
  sim: SimState,
  source: EnemySlot,
  point: { readonly x: number; readonly y: number },
): boolean {
  return elementalSegmentIsReachable({
    sim,
    source: source.entity,
    ...(source.arenaKey ? { arenaKey: source.arenaKey } : {}),
    x: Math.floor(point.x),
    y: Math.floor(point.y),
    maximumHeightDifference: Number.POSITIVE_INFINITY,
  });
}
