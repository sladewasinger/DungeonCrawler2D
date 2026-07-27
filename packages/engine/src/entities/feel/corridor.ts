import { TICK_DT } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import { createBody, stepBody } from "../movement/index.js";
import { dirVector, type CardinalDirection } from "./worldFixture.js";

const CORRIDOR_ENTRY_BUDGET_TICKS = 60;

export interface CorridorEntryResult {
  direction: CardinalDirection;
  offset: number;
  entered: boolean;
  ticksUsed: number;
}

function corridorEntryWorld(dx: number): WorldView {
  const along = (tx: number, ty: number): number => dx ? tx : ty;
  const perpendicular = (tx: number, ty: number): number => dx ? ty : tx;
  return {
    isWalkable: (tx, ty) => along(tx, ty) !== 8 || perpendicular(tx, ty) === 10,
    heightAt: () => 0,
    groundAt: () => 0,
    stairHeightAt: () => null,
  };
}

function corridorBody(direction: CardinalDirection, offset: number) {
  const [dx, dy] = dirVector(direction);
  const sign = dx || dy;
  const perpendicularStart = 10.5 + offset;
  const alongStart = sign > 0 ? 5.5 : 10.5;
  return { body: createBody(dx ? alongStart : perpendicularStart, dx ? perpendicularStart : alongStart, 0), dx, dy, sign };
}

function crossedCorridorWall(along: number, sign: number): boolean {
  return sign > 0 ? along > 9 : along < 8;
}

export function measureCorridorEntry(direction: CardinalDirection, offset: number): CorridorEntryResult {
  const { body, dx, dy, sign } = corridorBody(direction, offset);
  const world = corridorEntryWorld(dx);
  for (let tick = 1; tick <= CORRIDOR_ENTRY_BUDGET_TICKS; tick++) {
    stepBody(world, body, { moveX: dx, moveY: dy, jump: false }, TICK_DT);
    const along = dx ? body.x : body.y;
    if (crossedCorridorWall(along, sign)) return { direction, offset, entered: true, ticksUsed: tick };
  }
  return { direction, offset, entered: false, ticksUsed: CORRIDOR_ENTRY_BUDGET_TICKS };
}
