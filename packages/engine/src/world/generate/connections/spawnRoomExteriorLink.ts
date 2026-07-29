import { TILE } from "../../core/types.js";
import { carveLegs } from "./corridors.js";
import { lPathLegs } from "../layout/geometry.js";
import type { Point } from "../types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

const LINK_WIDTH =
  WORLD_GENERATION_TUNING.corridors.fixedFeatureLinkWidth;

export interface SpawnRoomExteriorLink {
  readonly before: Uint8Array;
  readonly tiles: Uint8Array;
  readonly corridorCarved: Uint8Array;
  readonly size: number;
  readonly approach: Point;
  readonly frontY: number;
}

/**
 * Joins the exterior apron to the nearest pre-existing floor in front of the
 * facade. Restricting the target to the facade's south side prevents a route
 * from tunneling through the building it is meant to reveal.
 */
export function connectSpawnRoomExterior(
  context: SpawnRoomExteriorLink,
): void {
  const target = nearestFrontFloor(context);
  if (!target) return;
  const legs = lPathLegs({
    from: context.approach,
    fromVertical: true,
    to: target,
    width: LINK_WIDTH,
    size: context.size,
  });
  carveLegs({
    tiles: context.tiles,
    corridorCarved: context.corridorCarved,
    chunkSize: context.size,
    legs,
  });
}

function nearestFrontFloor(
  context: SpawnRoomExteriorLink,
): Point | null {
  let best: FloorCandidate | null = null;
  for (let y = context.frontY; y < context.size; y++) {
    best = nearestFloorInRow(context, y, best);
  }
  return best?.point ?? null;
}

interface FloorCandidate {
  readonly point: Point;
  readonly distance: number;
}

function nearestFloorInRow(
  context: SpawnRoomExteriorLink,
  y: number,
  current: FloorCandidate | null,
): FloorCandidate | null {
  let best = current;
  for (let x = 0; x < context.size; x++) {
    if (context.before[y * context.size + x] !== TILE.Floor) continue;
    const distance = Math.abs(x - context.approach.x) +
      Math.abs(y - context.approach.y);
    if (best && distance >= best.distance) continue;
    best = { point: { x, y }, distance };
  }
  return best;
}
