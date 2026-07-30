import type { EnemySlot, SimState } from "../../state/state.js";
import { elementalSegmentIsReachable } from "./flameBoundary.js";

export interface OilLobBoundarySource {
  readonly entity: EnemySlot["entity"];
  readonly arenaKey?: string;
}

export function captureOilLobBoundarySource(
  source: EnemySlot,
): OilLobBoundarySource {
  return {
    entity: source.entity,
    ...(source.arenaKey ? { arenaKey: source.arenaKey } : {}),
  };
}

export function oilSourceFor(
  sim: SimState,
  ownerId: string | undefined,
  launchedSource: OilLobBoundarySource | undefined,
): OilLobBoundarySource | undefined {
  const liveSource = sim.enemies.get(ownerId ?? "");
  return liveSource ? captureOilLobBoundarySource(liveSource) : launchedSource;
}

export function oilCellIsReachable(
  sim: SimState,
  source: OilLobBoundarySource,
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
