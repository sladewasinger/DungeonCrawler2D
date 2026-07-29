import type { Entity, MoveInput, WorldView } from "@dc2d/engine";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

interface PursuitJumpInput {
  readonly world: WorldView;
  readonly enemy: Entity;
  readonly target: { x: number; y: number; z: number } | undefined;
  readonly move: MoveInput;
}

/** Adds a grounded jump only when a visible target stands one ledge higher. */
export function withPursuitJump(input: PursuitJumpInput): MoveInput {
  if (!input.target || !input.enemy.body.grounded ||
      !hasMovement(input.move)) return input.move;
  const rise = groundHeight(input.world, input.target) -
    groundHeight(input.world, input.enemy.body);
  if (!isJumpableRise(rise) ||
      horizontalDistance(input.enemy, input.target) >
        ENEMY_SIMULATION_TUNING.perception.jumpApproachDistanceTiles) {
    return input.move;
  }
  return { ...input.move, jump: true };
}

function hasMovement(move: MoveInput): boolean {
  return move.moveX !== 0 || move.moveY !== 0;
}

function groundHeight(
  world: WorldView,
  point: { x: number; y: number },
): number {
  return world.groundAt(point.x, point.y);
}

function isJumpableRise(rise: number): boolean {
  const tuning = ENEMY_SIMULATION_TUNING.perception;
  return Math.abs(rise - tuning.jumpRiseTiles) <= tuning.jumpHeightTolerance;
}

function horizontalDistance(
  entity: Entity,
  point: { x: number; y: number },
): number {
  return Math.hypot(
    point.x - entity.body.x,
    point.y - entity.body.y,
  );
}
