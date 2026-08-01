import type { Entity } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";
import {
  ATTACK_KIND,
  RANGED_SPREADS,
  RANGED_STANDOFF_DIRECTIONS,
} from "./attackSpacingTypes.js";
import {
  attackSeed,
  rangedDirectionKey,
  slotReachable,
  slotWalkable,
} from "./attackSpacingUtils.js";

const RANGED_STANDOFF_DISTANCE_INSET = 0.25;
const RANGED_STANDOFF_DISTANCE_RATIO = 0.85;
const RANGED_SLOT_EPSILON = 1e-6;

export interface SpreadVector {
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RangedSpreadPointInput {
  sim: SimState;
  enemy: EnemySlot;
  target: Entity;
  targetId: string;
  occupied: Set<string>;
  attackRange: number;
}

export interface RangedSlot {
  direction: SpreadVector;
  aimOffset: SpreadVector;
  point: Point;
}

export function chooseRangedSelection(input: RangedSpreadPointInput): RangedSlot {
  const reused = reuseRangedSelection(input);
  if (reused) return reused;
  const seed = attackSeed(input.enemy.entity.id, input.target.id);
  let fallbackDirection = initialDirection();
  let fallbackIndex = 0;
  for (let offset = 0; offset < RANGED_STANDOFF_DIRECTIONS.length; offset++) {
    const directionIndex = (seed + offset) % RANGED_STANDOFF_DIRECTIONS.length;
    const direction = rangedDirectionAt(directionIndex);
    const point = rangedFiringPoint(input.target, direction, input.attackRange);
    if (input.occupied.has(rangedDirectionKey(direction))) continue;
    fallbackDirection = direction;
    fallbackIndex = directionIndex;
    if (isRangedFiringPointReachable(input.sim, input.enemy, point)) {
      return buildRangedSelection(input, directionIndex, point);
    }
  }
  return buildRangedSelection(
    input,
    fallbackIndex,
    rangedFiringPoint(input.target, fallbackDirection, input.attackRange),
  );
}

export function isRangedFiringPointReachable(
  sim: SimState,
  enemy: EnemySlot,
  point: Point,
): boolean {
  return slotWalkable(sim, enemy, point) && slotReachable(sim, enemy, point);
}

function reuseRangedSelection(input: RangedSpreadPointInput): RangedSlot | undefined {
  const reservation = input.enemy.attackReservation;
  if (!reservation || reservation.kind !== ATTACK_KIND.rangedAim) return;
  if (reservation.targetId !== input.targetId) return;
  const match = RANGED_STANDOFF_DIRECTIONS.findIndex((direction) => {
    if (!direction) return false;
    const point = rangedFiringPoint(input.target, direction, input.attackRange);
    return isPointMatchingReservation(point, reservation);
  });
  if (match < 0) return;
  const direction = rangedDirectionAt(match);
  const point = rangedFiringPoint(input.target, direction, input.attackRange);
  if (input.occupied.has(rangedDirectionKey(direction))) return;
  if (!isRangedFiringPointReachable(input.sim, input.enemy, point)) return;
  return buildRangedSelection(input, match, point);
}

function initialDirection(): SpreadVector {
  return rangedDirectionAt(0);
}

function rangedDirectionAt(index: number): SpreadVector {
  const direction = RANGED_STANDOFF_DIRECTIONS[index];
  if (direction) return direction;
  const fallback = RANGED_STANDOFF_DIRECTIONS[0];
  if (!fallback) {
    throw new Error("No ranged standoff directions configured");
  }
  return fallback;
}

function buildRangedSelection(
  input: RangedSpreadPointInput,
  directionIndex: number,
  point: Point,
): RangedSlot {
  const seed = attackSeed(input.enemy.entity.id, input.target.id);
  const aimOffset = rangedSpreadAt((seed + directionIndex) % RANGED_SPREADS.length);
  return {
    direction: rangedDirectionAt(directionIndex),
    aimOffset,
    point,
  };
}

function rangedSpreadAt(index: number): SpreadVector {
  const spread = RANGED_SPREADS[index];
  if (spread) return spread;
  const fallback = RANGED_SPREADS[0];
  if (!fallback) {
    throw new Error("No ranged spread vectors configured");
  }
  return fallback;
}

function isPointMatchingReservation(
  point: Point,
  reservation: { x: number; y: number },
): boolean {
  return Math.abs(point.x - reservation.x) <= RANGED_SLOT_EPSILON &&
    Math.abs(point.y - reservation.y) <= RANGED_SLOT_EPSILON;
}

function rangedFiringPoint(target: Entity, direction: SpreadVector, attackRange: number): Point {
  const distance = Math.max(
    attackRange - RANGED_STANDOFF_DISTANCE_INSET,
    attackRange * RANGED_STANDOFF_DISTANCE_RATIO,
  );
  return {
    x: target.body.x + direction.x * distance,
    y: target.body.y + direction.y * distance,
    z: target.body.z,
  };
}
