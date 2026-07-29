import { AOI_RADIUS, type ServerSnapshot } from "@dc2d/engine";
import {
  areaCoordinatesWithin,
  enteringAreaCoordinates,
  type AreaCoordinate,
} from "./areaAoiCoordinates.js";
import type { SnapshotPendingState } from "../state/snapshotState.js";
import type { AoiCenter, PlayerSlot, SimState } from "../state/state.js";

export type AoiCheck = (x: number, y: number) => boolean;

export interface AreaDelivery {
  readonly areas: ServerSnapshot["areas"];
  readonly keys: string[];
  readonly includesFullAreas: boolean;
  readonly coverageCenter: AoiCenter;
}

export function deliveryAoi(slot: PlayerSlot): AoiCheck {
  return aoiAt(areaAoiCenter(slot));
}

export function areaSnapshot(request: {
  sim: SimState;
  slot: PlayerSlot;
  pending: SnapshotPendingState;
}): AreaDelivery {
  const coverageCenter = areaAoiCenter(request.slot);
  const backfill = request.slot.needsFullAreas
    ? areaTilesWithin(request.sim, coverageCenter)
    : enteringAreaTiles(request.sim, coverageCenter, request.slot.lastAreaAoiCenter);
  return areaDelivery({ pending: request.pending, backfill, coverageCenter, includesFullAreas: request.slot.needsFullAreas });
}

function areaDelivery(request: {
  pending: SnapshotPendingState;
  backfill: ServerSnapshot["areas"];
  coverageCenter: AoiCenter;
  includesFullAreas: boolean;
}): AreaDelivery {
  const areas = new Map(request.pending.areas);
  for (const area of request.backfill) areas.set(areaKey(area.x, area.y), area);
  return {
    areas: [...areas.values()],
    keys: [...request.pending.areas.keys()],
    coverageCenter: request.coverageCenter,
    includesFullAreas: request.includesFullAreas,
  };
}

function enteringAreaTiles(
  sim: SimState,
  current: AoiCenter,
  previous: AoiCenter | undefined,
): ServerSnapshot["areas"] {
  if (!previous) return areaTilesWithin(sim, current);
  if (sameCenter(current, previous)) return [];
  return areaTilesAt(sim, enteringAreaCoordinates(current, previous));
}

function areaTilesWithin(
  sim: SimState,
  center: AoiCenter,
): ServerSnapshot["areas"] {
  return areaTilesAt(sim, areaCoordinatesWithin(center));
}

function areaTilesAt(
  sim: SimState,
  coordinates: readonly AreaCoordinate[],
): ServerSnapshot["areas"] {
  return coordinates.flatMap(({ x, y }) =>
    areaTileAt(sim, x, y) ?? []
  );
}

function areaTileAt(
  sim: SimState,
  x: number,
  y: number,
): ServerSnapshot["areas"][number] | null {
  const layers = sim.areas.defsAt(x, y);
  const defId = layers.at(-1);
  if (!defId) return null;
  return layers.length > 1 ? { x, y, defId, layers } : { x, y, defId };
}

function areaAoiCenter(slot: PlayerSlot): AoiCenter {
  return { x: slot.entity.body.x, y: slot.entity.body.y };
}

function aoiAt(center: AoiCenter): AoiCheck {
  return (x, y) => (x - center.x) ** 2 + (y - center.y) ** 2 <= AOI_RADIUS ** 2;
}

function sameCenter(left: AoiCenter, right: AoiCenter): boolean {
  return left.x === right.x && left.y === right.y;
}

function areaKey(x: number, y: number): string {
  return `${x},${y}`;
}
