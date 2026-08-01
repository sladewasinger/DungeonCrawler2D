import {
  CHUNK_SIZE,
  containsPoint,
  hasTerrainLineOfSight,
  miniBossArenaAtPosition,
  roomKindAt,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ELEMENTAL_ENEMY_TUNING } from "./configuration/elementalEnemyTuning.js";

export interface FlameCellCheck {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly x: number;
  readonly y: number;
  readonly previous?: { readonly x: number; readonly y: number };
}

export interface ElementalSegmentCheck {
  readonly sim: SimState;
  readonly source: EnemySlot["entity"];
  readonly arenaKey?: string;
  readonly x: number;
  readonly y: number;
  readonly maximumHeightDifference: number;
  readonly from?: { readonly x: number; readonly y: number };
}

export function flameCellIsReachable(input: FlameCellCheck): boolean {
  const { enemy } = input;
  return elementalSegmentIsReachable({
    sim: input.sim,
    source: enemy.entity,
    ...(enemy.arenaKey ? { arenaKey: enemy.arenaKey } : {}),
    ...(input.previous
      ? { from: { x: input.previous.x + 0.5, y: input.previous.y + 0.5 } }
      : {}),
    x: input.x,
    y: input.y,
    maximumHeightDifference:
      ELEMENTAL_ENEMY_TUNING.directionalFlame.maximumElevationDifference,
  });
}

export function elementalSegmentIsReachable(
  input: ElementalSegmentCheck,
): boolean {
  const { sim, source, x, y } = input;
  if (!sim.world.isWalkable(x, y) || sim.world.isSanctuary(x, y)) {
    return false;
  }
  if (!sameRoomDomain(source.body, { x, y })) return false;
  if (!sameArenaDomain(input)) return false;
  return hasTerrainLineOfSight({
    world: sim.world,
    from: input.from ?? source.body,
    to: { x: x + 0.5, y: y + 0.5 },
    maximumHeightDifference: input.maximumHeightDifference,
  });
}

function sameRoomDomain(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): boolean {
  return roomDomain(from) === roomDomain(to);
}

function roomDomain(point: {
  readonly x: number;
  readonly y: number;
}): string | null {
  const cx = Math.floor(point.x / CHUNK_SIZE);
  const cy = Math.floor(point.y / CHUNK_SIZE);
  const kind = roomKindAt(cx, cy);
  return kind ? `${kind}:${cx},${cy}` : null;
}

function sameArenaDomain(input: ElementalSegmentCheck): boolean {
  const { sim, source, arenaKey, x, y } = input;
  if (arenaKey) {
    const arena = miniBossArenaAtPosition(
      sim.world,
      source.body.x,
      source.body.y,
    );
    return arena?.key === arenaKey &&
      containsPoint(arena.interior, x + 0.5, y + 0.5);
  }
  const sourceArena = miniBossArenaAtPosition(
    sim.world,
    input.source.body.x,
    input.source.body.y,
  );
  const target = miniBossArenaAtPosition(sim.world, x + 0.5, y + 0.5);
  return sourceArena?.key === target?.key;
}
